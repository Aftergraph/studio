import SwiftUI
struct WorkView: View {
    var body: some View {
        List {
            WorkSummaryRow(title: "Build Q4 business report", detail: "Data Analysis Agent · 2–3 min", progress: 0.65)
            WorkSummaryRow(title: "Deploy production release", detail: "Release Agent · Needs approval", progress: 0.92)
            WorkSummaryRow(title: "Research competitor landscape", detail: "Research Agent · 7 min", progress: 0.78)
        }.navigationTitle("Work").searchable(text: .constant(""), prompt: "Search work")
    }
}
