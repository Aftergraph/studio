# SwiftUI reference layer — Living Interface v4

The SwiftUI source keeps **Chat** and **Work** as the two primary modes using native `TabView`/`NavigationStack` semantics. Artifact and approval work is presented through native sheets and focus surfaces, while V4 motion semantics map to SwiftUI springs, matched-geometry-style transitions, symbol effects and sensory feedback where supported.

Source is verified with `swiftc -parse` plus contract checks. This environment does not provide Xcode or an iOS Simulator, so no native runtime verification claim is made.
