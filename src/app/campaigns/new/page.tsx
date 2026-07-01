import PanelLayout from "@/components/PanelLayout";
import { NewCampaignForm } from "@/components/campaigns/NewCampaignForm";

function NewCampaignBody() {
  return <NewCampaignForm />;
}

export default function NewCampaignPage() {
  return (
    <PanelLayout title="Yeni Kampanya">
      <NewCampaignBody />
    </PanelLayout>
  );
}
