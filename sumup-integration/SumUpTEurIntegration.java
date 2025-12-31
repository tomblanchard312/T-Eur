// SumUp Integration for tEUR Token Payments
// This code integrates with SumUp's REST API to accept tEUR payments
//
// IMPORTANT: This file contains Java code that requires:
// - OkHttp library (okhttp3.*)
// - JSON library (org.json.*)
// - SumUp API key and merchant code
//
// Required dependencies in build.gradle:
// implementation 'com.squareup.okhttp3:okhttp:latest-version'
// implementation 'org.json:json:latest-version'

import okhttp3.*;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.IOException;
import java.util.UUID;

public class SumUpTEurIntegration {

    private static final String SUMUP_API_BASE_URL = "https://api.sumup.com/v0.1";
    private static final String TEUR_API_BASE_URL = "http://your-api-url/api/v1"; // Replace with actual API URL
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final OkHttpClient client;
    private final String apiKey;
    private final String merchantCode;

    public SumUpTEurIntegration(String apiKey, String merchantCode) {
        this.client = new OkHttpClient();
        this.apiKey = apiKey;
        this.merchantCode = merchantCode;
    }

    /**
     * Creates a checkout for tEUR payment
     */
    public String createCheckout(double amount, String description) throws IOException {
        JSONObject checkoutData = new JSONObject();
        checkoutData.put("checkout_reference", UUID.randomUUID().toString());
        checkoutData.put("amount", amount);
        checkoutData.put("currency", "EUR");
        checkoutData.put("merchant_code", merchantCode);
        checkoutData.put("description", description);

        RequestBody body = RequestBody.create(checkoutData.toString(), JSON);
        Request request = new Request.Builder()
                .url(SUMUP_API_BASE_URL + "/checkouts")
                .post(body)
                .addHeader("Authorization", "Bearer " + apiKey)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                JSONObject responseJson = new JSONObject(response.body().string());
                return responseJson.getString("id");
            } else {
                throw new IOException("Failed to create checkout: " + response.body().string());
            }
        }
    }

    /**
     * Processes a checkout with card payment
     */
    public boolean processCheckout(String checkoutId, String cardToken) throws IOException {
        JSONObject paymentData = new JSONObject();
        paymentData.put("payment_type", "card");

        JSONObject cardData = new JSONObject();
        cardData.put("token", cardToken);
        paymentData.put("card", cardData);

        RequestBody body = RequestBody.create(paymentData.toString(), JSON);
        Request request = new Request.Builder()
                .url(SUMUP_API_BASE_URL + "/checkouts/" + checkoutId)
                .put(body)
                .addHeader("Authorization", "Bearer " + apiKey)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                JSONObject responseJson = new JSONObject(response.body().string());
                String status = responseJson.getString("status");
                return "PAID".equals(status);
            } else {
                return false;
            }
        }
    }

    /**
     * Processes payment with physical SumUp reader
     */
    public String processWithReader(String readerId, double amount, String description) throws IOException {
        JSONObject checkoutData = new JSONObject();

        JSONObject amountData = new JSONObject();
        amountData.put("currency", "EUR");
        amountData.put("minor_unit", 2);
        amountData.put("value", (int) (amount * 100)); // Convert to minor units

        checkoutData.put("total_amount", amountData);
        checkoutData.put("description", description);

        RequestBody body = RequestBody.create(checkoutData.toString(), JSON);
        Request request = new Request.Builder()
                .url(SUMUP_API_BASE_URL + "/merchants/" + merchantCode + "/readers/" + readerId + "/checkout")
                .post(body)
                .addHeader("Authorization", "Bearer " + apiKey)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                JSONObject responseJson = new JSONObject(response.body().string());
                JSONObject data = responseJson.getJSONObject("data");
                return data.getString("client_transaction_id");
            } else {
                throw new IOException("Failed to process with reader: " + response.body().string());
            }
        }
    }

    /**
     * Retrieves checkout status
     */
    public String getCheckoutStatus(String checkoutId) throws IOException {
        Request request = new Request.Builder()
                .url(SUMUP_API_BASE_URL + "/checkouts/" + checkoutId)
                .get()
                .addHeader("Authorization", "Bearer " + apiKey)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                JSONObject responseJson = new JSONObject(response.body().string());
                return responseJson.getString("status");
            } else {
                throw new IOException("Failed to get checkout status: " + response.body().string());
            }
        }
    }

    /**
     * Releases tEUR tokens after successful payment
     */
    public boolean releaseTEurTokens(String paymentId, String secret) throws IOException {
        JSONObject releaseData = new JSONObject();
        releaseData.put("paymentId", paymentId);
        releaseData.put("secret", secret);

        RequestBody body = RequestBody.create(releaseData.toString(), JSON);
        Request request = new Request.Builder()
                .url(TEUR_API_BASE_URL + "/payments/" + paymentId + "/release")
                .post(body)
                .addHeader("X-API-Key", "your-api-key") // Replace with actual key
                .build();

        try (Response response = client.newCall(request).execute()) {
            return response.isSuccessful();
        }
    }

    /**
     * Lists available readers for the merchant
     */
    public JSONArray listReaders() throws IOException {
        Request request = new Request.Builder()
                .url(SUMUP_API_BASE_URL + "/merchants/" + merchantCode + "/readers")
                .get()
                .addHeader("Authorization", "Bearer " + apiKey)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                JSONObject responseJson = new JSONObject(response.body().string());
                return responseJson.getJSONArray("items");
            } else {
                throw new IOException("Failed to list readers: " + response.body().string());
            }
        }
    }

    /**
     * Gets reader status
     */
    public JSONObject getReaderStatus(String readerId) throws IOException {
        Request request = new Request.Builder()
                .url(SUMUP_API_BASE_URL + "/merchants/" + merchantCode + "/readers/" + readerId + "/status")
                .get()
                .addHeader("Authorization", "Bearer " + apiKey)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                return new JSONObject(response.body().string());
            } else {
                throw new IOException("Failed to get reader status: " + response.body().string());
            }
        }
    }

    /**
     * Main payment flow for tEUR using SumUp
     */
    public boolean processTEurPayment(double amount, String description, String readerId) {
        try {
            // Step 1: Process payment with SumUp reader
            String transactionId = processWithReader(readerId, amount, description);

            // Step 2: Wait for payment completion (in real implementation, use webhooks)
            Thread.sleep(2000); // Simple delay for demo

            // Step 3: Verify payment status
            // In real implementation, check transaction status via API

            // Step 4: Extract payment data from NFC/QR (placeholder)
            String paymentId = extractPaymentIdFromNFC();
            String secret = extractSecretFromNFC();

            // Step 5: Release tEUR tokens
            return releaseTEurTokens(paymentId, secret);

        } catch (Exception e) {
            System.err.println("Payment processing failed: " + e.getMessage());
            return false;
        }
    }

    // Placeholder methods for NFC reading (implement with Android NFC APIs)
    private String extractPaymentIdFromNFC() {
        // Implement NFC NDEF reading to extract payment ID
        return "payment-id-from-nfc";
    }

    private String extractSecretFromNFC() {
        // Implement NFC NDEF reading to extract secret
        return "secret-from-nfc";
    }
}

// Usage example:
/*
 * public class MainActivity extends AppCompatActivity {
 * 
 * private SumUpTEurIntegration sumUpIntegration;
 * 
 * @Override
 * protected void onCreate(Bundle savedInstanceState) {
 * super.onCreate(savedInstanceState);
 * setContentView(R.layout.activity_main);
 * 
 * // Initialize SumUp integration
 * sumUpIntegration = new SumUpTEurIntegration(
 * "your-sumup-api-key",
 * "your-merchant-code"
 * );
 * 
 * // Example payment processing
 * Button payButton = findViewById(R.id.payButton);
 * payButton.setOnClickListener(v -> {
 * new Thread(() -> {
 * try {
 * JSONArray readers = sumUpIntegration.listReaders();
 * if (readers.length() > 0) {
 * String readerId = readers.getJSONObject(0).getString("id");
 * boolean success = sumUpIntegration.processTEurPayment(
 * 10.50, "tEUR Purchase", readerId
 * );
 * 
 * runOnUiThread(() -> {
 * Toast.makeText(this,
 * success ? "Payment successful!" : "Payment failed",
 * Toast.LENGTH_SHORT).show();
 * });
 * }
 * } catch (Exception e) {
 * runOnUiThread(() -> {
 * Toast.makeText(this, "Error: " + e.getMessage(),
 * Toast.LENGTH_SHORT).show();
 * });
 * }
 * }).start();
 * });
 * }
 * }
 */