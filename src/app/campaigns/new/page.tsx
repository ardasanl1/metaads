import Link from "next/link";
import { HelpCircle } from "lucide-react";
import PanelLayout from "@/components/PanelLayout";
import { WebsiteSalesWizard } from "@/components/campaigns/wizard/WebsiteSalesWizard";
import { Button } from "@/components/ui/button";

function NewCampaignBody() {
  return <WebsiteSalesWizard />;
}

export default function NewCampaignPage() {
  return (
    <PanelLayout
      title="Yeni Reklam"
      subtitle="Birkaç soruyla kampanyanızı oluşturun"
      wide
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings">
            <HelpCircle className="mr-2 h-4 w-4" />
            Yardım
          </Link>
        </Button>
      }
    >
      <NewCampaignBody />
    </PanelLayout>
  );
}
