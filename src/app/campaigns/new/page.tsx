import PanelLayout from "@/components/PanelLayout";
import { WebsiteSalesWizard } from "@/components/campaigns/wizard/WebsiteSalesWizard";

function NewCampaignBody() {
  return <WebsiteSalesWizard />;
}

export default function NewCampaignPage() {
  return (
    <PanelLayout title="Yeni Reklam">
      <NewCampaignBody />
    </PanelLayout>
  );
}
