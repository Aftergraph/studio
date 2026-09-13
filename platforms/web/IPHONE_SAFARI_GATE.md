# iPhone Safari/Home Screen Gate - Aftergraph Compose

## Overview
This document outlines the requirements and verification steps for the physical iPhone Safari and Home Screen gate for Aftergraph Compose PWA.

## Requirements

### PWA Requirements
- [x] Web App Manifest (`/manifest.json`) with proper configuration
- [x] Service Worker (`/public/sw.js`) registered and functional
- [x] Apple Touch Icon (180x180) for Home Screen
- [x] Icons for various sizes (192x192, 512x512)
- [x] Theme color and background color defined
- [x] `apple-mobile-web-app-capable` meta tag
- [x] `apple-mobile-web-app-status-bar-style` meta tag

### Visual Requirements
- Dark theme matching Aftergraph design system
- Safe area handling for all iPhone models (notch, bottom bar)
- Responsive breakpoints for mobile screens
- Focus states for interactive elements
- Reduced motion support

## Verification Steps

### 1. Safari Browser Testing
1. Open Safari on iPhone
2. Navigate to the Compose web URL
3. Verify page loads correctly
4. Test all interactive elements (composer, buttons, dropdowns)
5. Verify responsive layout adapts to screen size
6. Test in both portrait and landscape orientations

### 2. Add to Home Screen
1. Tap the Share button in Safari
2. Select "Add to Home Screen"
3. Verify the icon appears correctly (not a screenshot)
4. Verify the app name is "Aftergraph Compose"
5. Tap the Home Screen icon to launch

### 3. Standalone Mode Verification
1. After adding to Home Screen, launch from icon
2. Verify Safari UI is hidden (no address bar, no navigation controls)
3. Verify the app appears as a standalone app
4. Verify status bar style is dark/black-translucent
5. Verify safe area insets are respected

### 4. Offline Functionality
1. Launch the app from Home Screen
2. Enable Airplane Mode
3. Verify the app still loads (service worker caching)
4. Verify basic functionality works offline

### 5. Visual QA Checklist
- [ ] Brand colors match Aftergraph palette
- [ ] Typography renders correctly
- [ ] Spacing and padding respect safe areas
- [ ] Touch targets are large enough (minimum 44x44px)
- [ ] Focus indicators are visible
- [ ] Reduced motion preference is respected
- [ ] Scroll behavior is smooth
- [ ] Form inputs work with iOS keyboard

## Test Devices
- iPhone 15 Pro Max (primary)
- iPhone 15
- iPhone 14
- iPhone SE (3rd generation)

## Expected Results
All verification steps should pass without visual glitches, layout issues, or functional errors.

## Troubleshooting
If any issues are found:
1. Check Safari Developer Console (via macOS Safari Web Inspector)
2. Verify service worker is registered: `navigator.serviceWorker.controller`
3. Check manifest loading: `navigator.standalone` should be `true`
4. Verify icon paths are correct and accessible

## Sign-off
- [ ] Safari browser testing: PASSED
- [ ] Add to Home Screen: PASSED
- [ ] Standalone mode: PASSED
- [ ] Offline functionality: PASSED
- [ ] Visual QA: PASSED
- [ ] All devices: PASSED
