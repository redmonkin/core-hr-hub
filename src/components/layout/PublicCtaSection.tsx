import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_URL } from "./publicSite";

interface PublicCtaSectionProps {
  title?: string;
  description?: string;
}

/** Closing call-to-action band shared by the public marketing pages. */
const PublicCtaSection = ({
  title = "Ready to transform your HR operations?",
  description = "Join the teams that have modernised their HR with Peoplo. Get started in minutes — no credit card required.",
}: PublicCtaSectionProps) => (
  <section className="bg-primary py-16 text-primary-foreground sm:py-20">
    <div className="container mx-auto px-4 text-center">
      <div className="mx-auto max-w-3xl space-y-6">
        <h2 className="text-3xl font-bold md:text-4xl">{title}</h2>
        <p className="text-lg text-white">{description}</p>
        <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row sm:gap-4">
          <Button asChild size="lg" variant="secondary" className="h-12 gap-2 px-8">
            <Link to="/auth">
              Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 gap-2 border-white/70 bg-transparent px-8 text-white hover:bg-white/10 hover:text-white"
          >
            <a href={DEMO_URL} target="_blank" rel="noopener noreferrer">
              Talk to sales
            </a>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default PublicCtaSection;
