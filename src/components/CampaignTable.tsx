import { sampleCampaigns, statusColor } from "@/lib/data";

export default function CampaignTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Kampanya</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Bütçe</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Durum</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Şehir</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Lead</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sampleCampaigns.map((campaign) => (
            <tr key={campaign.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{campaign.name}</td>
              <td className="px-4 py-3 text-gray-600">{campaign.budget}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(campaign.status)}`}
                >
                  {campaign.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{campaign.city}</td>
              <td className="px-4 py-3 text-gray-600">{campaign.leads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
