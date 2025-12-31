package com.teur.clover;

// Clover Custom Tender for tEUR Token Payments
// This code is part of a Clover Android app using the Payment Connector SDK

import android.nfc.Ndef;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.util.Log;
import com.clover.sdk.v3.connector.IPaymentConnector;
import com.clover.sdk.v3.payments.Payment;
import com.clover.sdk.v3.payments.Tender;
import okhttp3.*;
import org.json.JSONObject;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class TEurTender implements Tender {

    private static final String TEUR_TENDER_ID = "teur-tender";
    private static final String API_BASE_URL = "http://your-api-url/api/v1"; // Replace with actual API URL
    private static final String TAG = "TEurTender";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private OkHttpClient client = new OkHttpClient();
    private NfcAdapter nfcAdapter;

    // Store NFC data temporarily
    private volatile String currentPaymentId = null;
    private volatile String currentSecret = null;

    public TEurTender() {
        // Initialize NFC adapter - this would typically be passed from the Activity
        // context
        // For now, we'll handle NFC reading through method calls
        Log.d(TAG, "TEurTender initialized");
    }

    @Override
    public String getId() {
        return TEUR_TENDER_ID;
    }

    @Override
    public String getLabel() {
        return "tEUR Token";
    }

    @Override
    public boolean processPayment(Payment payment, IPaymentConnector.PaymentCallback callback) {
        // Extract payment data from NFC or manual input
        String paymentId = extractPaymentIdFromNFC(); // Implement NFC reading
        String secret = extractSecretFromNFC(); // Implement NFC reading

        if (paymentId == null || secret == null) {
            callback.onPaymentFailed(payment, new Exception("NFC data not available. Please tap NFC device."));
            return false;
        }

        // Call API to release payment
        JSONObject releaseData = new JSONObject();
        try {
            releaseData.put("paymentId", paymentId);
            releaseData.put("secret", secret);
        } catch (Exception e) {
            callback.onPaymentFailed(payment, new Exception("Failed to create payment data"));
            return false;
        }

        RequestBody body = RequestBody.create(releaseData.toString(), JSON);
        Request request = new Request.Builder()
                .url(API_BASE_URL + "/payments/" + paymentId + "/release")
                .post(body)
                .addHeader("X-API-Key", "your-api-key") // Replace with actual key
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "API call failed", e);
                callback.onPaymentFailed(payment, new Exception("API call failed"));
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    Log.d(TAG, "Payment successful");
                    // Payment successful
                    payment.setResult(Payment.Result.SUCCESS);
                    callback.onPaymentSucceeded(payment);
                } else {
                    Log.e(TAG, "Payment release failed: " + response.code());
                    callback.onPaymentFailed(payment, new Exception("Payment release failed"));
                }
            }
        });

        return true; // Async processing
    }

    private String extractPaymentIdFromNFC() {
        // Return the stored payment ID from NFC read
        // This would be set by calling readNfcTag() when NFC tag is detected
        return currentPaymentId;
    }

    private String extractSecretFromNFC() {
        // Return the stored secret from NFC read
        // This would be set by calling readNfcTag() when NFC tag is detected
        return currentSecret;
    }

    /**
     * Method to be called when an NFC tag is detected
     * This should be called from the Activity's NFC intent handler
     */
    public void readNfcTag(Tag tag) {
        try {
            Ndef ndef = Ndef.get(tag);
            if (ndef == null) {
                Log.w(TAG, "NDEF not supported on this tag");
                return;
            }

            ndef.connect();
            NdefMessage ndefMessage = ndef.getNdefMessage();
            ndef.close();

            if (ndefMessage == null) {
                Log.w(TAG, "No NDEF message found");
                return;
            }

            // Parse NDEF records
            parseNdefMessage(ndefMessage);

        } catch (Exception e) {
            Log.e(TAG, "Error reading NFC tag", e);
        }
    }

    /**
     * Parse NDEF message to extract payment data
     */
    private void parseNdefMessage(NdefMessage ndefMessage) {
        NdefRecord[] records = ndefMessage.getRecords();

        for (NdefRecord record : records) {
            if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN &&
                    java.util.Arrays.equals(record.getType(), NdefRecord.RTD_TEXT)) {

                // Parse text record
                String text = parseTextRecord(record);
                parsePaymentData(text);

            } else if (record.getTnf() == NdefRecord.TNF_EXTERNAL_TYPE) {
                // Handle custom MIME type for payment data
                String mimeType = new String(record.getType(), StandardCharsets.US_ASCII);
                if ("application/vnd.teur.payment".equals(mimeType)) {
                    String jsonData = new String(record.getPayload(), StandardCharsets.UTF_8);
                    parseJsonPaymentData(jsonData);
                }
            }
        }
    }

    /**
     * Parse text record containing payment data
     */
    private String parseTextRecord(NdefRecord record) {
        byte[] payload = record.getPayload();
        String textEncoding = ((payload[0] & 0200) == 0) ? "UTF-8" : "UTF-16";
        int languageCodeLength = payload[0] & 0077;

        try {
            return new String(payload, languageCodeLength + 1,
                    payload.length - languageCodeLength - 1, textEncoding);
        } catch (Exception e) {
            Log.e(TAG, "Error parsing text record", e);
            return null;
        }
    }

    /**
     * Parse payment data from text (format: "paymentId:secret")
     */
    private void parsePaymentData(String text) {
        if (text == null)
            return;

        String[] parts = text.split(":");
        if (parts.length >= 2) {
            currentPaymentId = parts[0].trim();
            currentSecret = parts[1].trim();
            Log.d(TAG, "Parsed payment data - ID: " + currentPaymentId);
        } else {
            Log.w(TAG, "Invalid payment data format: " + text);
        }
    }

    /**
     * Parse payment data from JSON
     */
    private void parseJsonPaymentData(String jsonData) {
        try {
            JSONObject json = new JSONObject(jsonData);
            currentPaymentId = json.optString("paymentId");
            currentSecret = json.optString("secret");
            Log.d(TAG, "Parsed JSON payment data - ID: " + currentPaymentId);
        } catch (Exception e) {
            Log.e(TAG, "Error parsing JSON payment data", e);
        }
    }

    /**
     * Clear stored NFC data (call after payment processing)
     */
    public void clearNfcData() {
        currentPaymentId = null;
        currentSecret = null;
        Log.d(TAG, "NFC data cleared");
    }
}