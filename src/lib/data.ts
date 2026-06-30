export const sampleCampaigns = [
  {
    id: 1,
    name: "İstanbul Lead Kampanyası",
    budget: "₺500",
    status: "Aktif",
    city: "İstanbul",
    leads: 12,
  },
  {
    id: 2,
    name: "Ankara Form Kampanyası",
    budget: "₺350",
    status: "Aktif",
    city: "Ankara",
    leads: 9,
  },
  {
    id: 3,
    name: "İzmir Trafik Kampanyası",
    budget: "₺250",
    status: "Duraklatıldı",
    city: "İzmir",
    leads: 5,
  },
  {
    id: 4,
    name: "Bursa Lead Kampanyası",
    budget: "₺150",
    status: "Taslak",
    city: "Bursa",
    leads: 12,
  },
];

export function statusColor(status: string) {
  switch (status) {
    case "Aktif":
      return "bg-green-100 text-green-800";
    case "Duraklatıldı":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
