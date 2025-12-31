// SumUp tEUR Payment Activity
// Android activity demonstrating SumUp integration for tEUR payments

import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import org.json.JSONArray;
import org.json.JSONObject;

public class SumUpPaymentActivity extends AppCompatActivity {

    private SumUpTEurIntegration sumUpIntegration;
    private TextView statusText;
    private Button payButton;
    private NfcAdapter nfcAdapter;

    // SumUp configuration - replace with your actual credentials
    private static final String SUMUP_API_KEY = "your-sumup-api-key";
    private static final String SUMUP_MERCHANT_CODE = "your-merchant-code";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_sumup_payment);

        // Initialize views
        statusText = findViewById(R.id.statusText);
        payButton = findViewById(R.id.payButton);

        // Initialize SumUp integration
        sumUpIntegration = new SumUpTEurIntegration(SUMUP_API_KEY, SUMUP_MERCHANT_CODE);

        // Initialize NFC
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);
        if (nfcAdapter == null) {
            Toast.makeText(this, "NFC not available on this device", Toast.LENGTH_LONG).show();
        }

        // Set up payment button
        payButton.setOnClickListener(v -> processPayment());

        // Load available readers
        loadReaders();
    }

    private void loadReaders() {
        new Thread(() -> {
            try {
                JSONArray readers = sumUpIntegration.listReaders();
                runOnUiThread(() -> {
                    statusText.setText("Found " + readers.length() + " SumUp readers");
                    payButton.setEnabled(readers.length() > 0);
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    statusText.setText("Error loading readers: " + e.getMessage());
                    payButton.setEnabled(false);
                });
            }
        }).start();
    }

    private void processPayment() {
        payButton.setEnabled(false);
        statusText.setText("Processing payment...");

        new Thread(() -> {
            try {
                // Get first available reader
                JSONArray readers = sumUpIntegration.listReaders();
                if (readers.length() == 0) {
                    throw new Exception("No readers available");
                }

                String readerId = readers.getJSONObject(0).getString("id");

                // Process payment
                boolean success = sumUpIntegration.processTEurPayment(
                        15.75, // Amount
                        "tEUR Coffee Purchase", // Description
                        readerId // Reader ID
                );

                runOnUiThread(() -> {
                    if (success) {
                        statusText.setText("Payment successful! tEUR tokens released.");
                        Toast.makeText(this, "tEUR tokens released!", Toast.LENGTH_LONG).show();
                    } else {
                        statusText.setText("Payment failed");
                        Toast.makeText(this, "Payment failed", Toast.LENGTH_SHORT).show();
                    }
                    payButton.setEnabled(true);
                });

            } catch (Exception e) {
                runOnUiThread(() -> {
                    statusText.setText("Error: " + e.getMessage());
                    payButton.setEnabled(true);
                    Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }
        }).start();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Enable NFC foreground dispatch for reading NFC tags
        if (nfcAdapter != null) {
            // Set up NFC intent filters (implementation depends on your NFC requirements)
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Disable NFC foreground dispatch
        if (nfcAdapter != null) {
            // Clean up NFC handling
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        // Handle NFC tag discovery
        if (NfcAdapter.ACTION_TAG_DISCOVERED.equals(intent.getAction())) {
            Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
            if (tag != null) {
                // Process NFC tag for payment data
                processNFCTag(tag);
            }
        }
    }

    private void processNFCTag(Tag tag) {
        // Read NDEF message from NFC tag
        NdefMessage[] messages = getNdefMessages(intent);
        if (messages != null && messages.length > 0) {
            for (NdefMessage message : messages) {
                for (NdefRecord record : message.getRecords()) {
                    // Extract payment data from NDEF record
                    String payload = new String(record.getPayload());
                    // Parse payment ID and secret from payload
                    // Update the integration with extracted data
                }
            }
        }
    }

    private NdefMessage[] getNdefMessages(Intent intent) {
        // Helper method to extract NDEF messages from NFC intent
        // Implementation depends on your NFC tag format
        return null;
    }
}

/*
 * AndroidManifest.xml permissions:
 * 
 * <uses-permission android:name="android.permission.INTERNET" />
 * <uses-permission android:name="android.permission.NFC" />
 * 
 * <intent-filter>
 * <action android:name="android.nfc.action.TAG_DISCOVERED" />
 * <category android:name="android.intent.category.DEFAULT" />
 * </intent-filter>
 * 
 * Layout file (activity_sumup_payment.xml):
 * 
 * <?xml version="1.0" encoding="utf-8"?>
 * <LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
 * android:layout_width="match_parent"
 * android:layout_height="match_parent"
 * android:orientation="vertical"
 * android:padding="16dp">
 * 
 * <TextView
 * android:id="@+id/statusText"
 * android:layout_width="match_parent"
 * android:layout_height="wrap_content"
 * android:text="Initializing SumUp..."
 * android:textSize="16sp"
 * android:layout_marginBottom="32dp" />
 * 
 * <Button
 * android:id="@+id/payButton"
 * android:layout_width="match_parent"
 * android:layout_height="wrap_content"
 * android:text="Pay with tEUR (€15.75)"
 * android:textSize="18sp"
 * android:enabled="false" />
 * 
 * </LinearLayout>
 */