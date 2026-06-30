import Link from "next/link";
import PanelLayout from "@/components/PanelLayout";

export default function NewCampaignPage() {
  return (
    <PanelLayout title="Yeni Kampanya">
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <p className="text-sm text-gray-600">
          Meta kampanyası oluşturma sonraki aşamada eklenecek.
        </p>
        <Link
          href="/campaigns"
          className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Kampanyalara Dön
        </Link>
      </div>
    </PanelLayout>
  );
}
