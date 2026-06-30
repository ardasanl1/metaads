import CampaignTable from "@/components/CampaignTable";
import PanelLayout from "@/components/PanelLayout";

const stats = [
  { label: "Toplam Kampanya", value: "4" },
  { label: "Aktif Kampanya", value: "2" },
  { label: "Günlük Bütçe", value: "₺1.250" },
  { label: "Toplam Lead", value: "38" },
];

export default function DashboardPage() {
  return (
    <PanelLayout title="Genel Bakış">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Son Kampanyalar</h2>
          <CampaignTable />
        </div>
      </div>
    </PanelLayout>
  );
}
