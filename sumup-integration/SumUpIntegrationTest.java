// SumUp Integration Test
// This demonstrates the basic usage of the SumUpTEurIntegration class

public class SumUpIntegrationTest {

    public static void main(String[] args) {
        // Initialize with test credentials (replace with real ones)
        SumUpTEurIntegration sumUp = new SumUpTEurIntegration(
                "sk_test_1234567890abcdef", // Test API key
                "MTEST123" // Test merchant code
        );

        try {
            // Test 1: List readers
            System.out.println("Testing reader listing...");
            JSONArray readers = sumUp.listReaders();
            System.out.println("Found " + readers.length() + " readers");

            if (readers.length() > 0) {
                String readerId = readers.getJSONObject(0).getString("id");
                System.out.println("Using reader: " + readerId);

                // Test 2: Process a payment
                System.out.println("Testing payment processing...");
                boolean success = sumUp.processTEurPayment(
                        5.00, // €5.00
                        "Test tEUR Purchase", // Description
                        readerId // Reader ID
                );

                System.out.println("Payment result: " + (success ? "SUCCESS" : "FAILED"));
            }

            // Test 3: Create checkout
            System.out.println("Testing checkout creation...");
            String checkoutId = sumUp.createCheckout(10.50, "Test Checkout");
            System.out.println("Created checkout: " + checkoutId);

            // Test 4: Check status
            String status = sumUp.getCheckoutStatus(checkoutId);
            System.out.println("Checkout status: " + status);

        } catch (Exception e) {
            System.err.println("Test failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
}

/*
 * Expected output (with real SumUp credentials):
 * 
 * Testing reader listing...
 * Found 1 readers
 * Using reader: rdr_abc123def456
 * Testing payment processing...
 * Payment result: SUCCESS
 * Testing checkout creation...
 * Created checkout: chk_def789ghi012
 * Checkout status: PENDING
 * 
 * Note: This test requires real SumUp API credentials and a configured reader.
 * In a real Android app, this would be run on device with proper permissions.
 */