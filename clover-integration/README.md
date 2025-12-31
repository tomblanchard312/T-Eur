# Clover Integration for tEUR Token Payments

This directory contains code for integrating tEUR token payments with Clover POS devices.

## Overview

The integration allows consumers to make contactless payments using tEUR tokens via NFC-enabled devices that communicate with Clover terminals.

## Components

### Consumer Wallet

- Located in `dashboard/src/pages/ConsumerWallet.tsx`
- Simulates NFC payment initiation
- In a real app, this would be a mobile app with native NFC capabilities

### Clover Custom Tender

- `TEurTender.java`: Java implementation of a custom tender for Clover
- Uses Clover Payment Connector SDK
- Processes payments by calling the tEUR API
- **Note**: This Java file will show import resolution errors in VS Code because the required Clover SDK and Android dependencies are not available in this workspace. These errors are expected and will not occur when the code is properly integrated into an Android Studio project with the correct dependencies.

## Setup

### Prerequisites

- Clover device with Payment Connector SDK
- Android development environment
- tEUR API running and accessible

### Installation

1. Create a new Android project in Android Studio
2. Add the required dependencies to `build.gradle`:
   ```gradle
   dependencies {
       implementation 'com.clover.sdk:clover-android-sdk:latest-version'
       implementation 'com.squareup.okhttp3:okhttp:latest-version'
       implementation 'org.json:json:latest-version'
   }
   ```
3. Copy `TEurTender.java` into your Android project
4. Register the tender with the PaymentConnector in your main activity
5. Configure API endpoints and keys

### NFC Flow

1. Consumer initiates payment in wallet app
2. Payment data (ID, secret) is encoded in NFC tag
3. Consumer taps device to Clover terminal
4. Clover reads NFC data and processes payment via API
5. Payment is released on the blockchain

## API Integration

The Clover tender calls these API endpoints:

- `POST /payments/{id}/release` - Release payment with secret

Ensure the API is configured with proper authentication and CORS settings for Clover devices.

## Security Notes

- Use secure NFC encryption (e.g., HCE with keys)
- Implement proper secret management
- Validate payment data on both consumer and merchant sides

## Development Notes

- The Java file in this repository is a code snippet and will display compilation errors in VS Code due to missing dependencies
- These errors will resolve once integrated into a proper Android/Clover development environment
- Refer to Clover's official documentation for the latest SDK versions and integration guides
