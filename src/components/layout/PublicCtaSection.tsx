import { ArrowRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Backdrop } from "@/components/landing/Backdrop";
import { REPO_URL } from "@/lib/site";
import { DEMO_URL } from "./publicSite";

interface PublicCtaSectionProps {
  title?: string;
  description?: string;
}

/** Closing call-to-action band shared by the public marketing pages. */
const PublicCtaSection = ({
  title = "Ready for calmer HR?",
  description = "Host Peoplo yourself for free, or book a demo and we'll set it up for you. It's open source under AGPL-3.0.",
}: PublicCtaSectionProps) => (
  <section className="px-4 py-16 sm:py-20">
    <div className="container relative mx-auto overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-sky-700 to-sky-900 px-6 py-14 text-center text-primary-foreground shadow-2xl shadow-primary/30 sm:py-16">
      <Backdrop tone="light" className="opacity-50" />
      <div className="relative mx-auto max-w-3xl space-y-6">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
        <p className="text-lg text-white/90">{description}</p>
        <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row sm:gap-4">
          <Button asChild size="lg" variant="secondary" className="group h-12 gap-2 px-8">
            <a href={DEMO_URL} target="_blank" rel="noopener noreferrer">
              Book a demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 gap-2 border-white/50 bg-transparent px-8 text-white hover:bg-white/10 hover:text-white"
          >
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" aria-hidden="true" />
              Star on GitHub
            </a>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default PublicCtaSection;
