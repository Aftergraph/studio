import SwiftUI

struct AttentionItem: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let symbol: String
    let color: Color
}

struct TodayView: View {
    private let needs = [
        AttentionItem(title: "Production deployment needs approval", detail: "Release 4.8.0 changes 4 services.", symbol: "exclamationmark.shield", color: .red),
        AttentionItem(title: "Research mission is near budget ceiling", detail: "€8.40 of €10.00 consumed.", symbol: "gauge.with.dots.needle.50percent", color: .orange),
        AttentionItem(title: "GitHub connector requires renewed access", detail: "A repository scope expired.", symbol: "link.badge.plus", color: .orange)
    ]
    var body: some View {
        List {
            Section("Needs your attention") {
                ForEach(needs) { item in
                    Button(action: {}) {
                        HStack(spacing: 12) {
                            Image(systemName: item.symbol).foregroundStyle(item.color).frame(width: 26)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                                Text(item.detail).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                        }.padding(.vertical, 5)
                    }.buttonStyle(.plain)
                }
            }
            Section("In progress") {
                WorkSummaryRow(title: "Build Q4 business report", detail: "Data Analysis Agent · 2–3 min", progress: 0.65)
                WorkSummaryRow(title: "Deploy production release", detail: "Release Agent · Needs approval", progress: 0.92)
                WorkSummaryRow(title: "Research competitor landscape", detail: "Research Agent · 7 min", progress: 0.78)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Today")
        .searchable(text: .constant(""), prompt: "Search or command")
    }
}

struct WorkSummaryRow: View {
    let title: String
    let detail: String
    let progress: Double
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "briefcase").frame(width: 26).foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(progress, format: .percent.precision(.fractionLength(0))).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
        }.padding(.vertical, 5)
    }
}
