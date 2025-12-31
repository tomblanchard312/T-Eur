# TEur Clover Android App

This Android app demonstrates integration with Clover POS devices for processing tEUR token payments via NFC.

## Project Structure

```
clover-android-app/
├── app/
│   ├── build.gradle          # App-level build configuration
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/teur/clover/
│       │   ├── MainActivity.java    # Main app activity
│       │   └── TEurTender.java      # Custom Clover tender implementation
│       └── res/
│           ├── layout/
│           │   └── activity_main.xml
│           └── values/
│               └── strings.xml
├── build.gradle              # Project-level build configuration
└── settings.gradle           # Project settings
```

## Setup Instructions

### Prerequisites

- Android Studio Arctic Fox or later
- Android SDK API 24+ (Android 7.0)
- Clover Android SDK
- NFC-capable Android device

### Installation

1. Open Android Studio
2. Select "Open an existing Android Studio project"
3. Navigate to and select the `clover-android-app` directory
4. Wait for Gradle sync to complete
5. If prompted, install any missing SDK components

### Configuration

1. Update `TEurTender.java` with your actual API endpoint:
   ```java
   private static final String API_BASE_URL = "https://your-api-domain.com/api/v1";
   ```
2. Update the API key:
   ```java
   .addHeader("X-API-Key", "your-actual-api-key")
   ```

### NFC Implementation

The current implementation includes placeholder methods for NFC reading. To implement actual NFC:

1. Add NFC permissions (already in AndroidManifest.xml)
2. Implement `NfcAdapter` in MainActivity
3. Update `extractPaymentIdFromNFC()` and `extractSecretFromNFC()` methods to read from NFC tags

## Building and Running

1. Connect an NFC-capable Android device
2. Enable USB debugging on the device
3. Click "Run" in Android Studio or use `gradlew installDebug`
4. The app will show initialization status

## Clover Integration

This app registers a custom tender with Clover that:

- Accepts NFC-based payment data
- Calls the tEUR API to process payments
- Returns success/failure to Clover

## Security Considerations

- Implement proper NFC encryption
- Use secure API authentication
- Validate all payment data
- Handle errors gracefully

## Development Notes

- The app requires Clover SDK which may need additional setup
- NFC functionality needs hardware testing
- API endpoints should use HTTPS in production
- Consider implementing proper error handling and user feedback
