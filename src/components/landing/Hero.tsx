"use client";

import { ArrowRight, ShieldCheck, BarChart3, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

interface HeroProps {
  onLoginClick?: () => void;
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Risk management",
    description: "Identify, assess, and monitor organizational risks.",
  },
  {
    icon: BarChart3,
    title: "KPI tracking",
    description: "Track performance and see results against targets.",
  },
  {
    icon: Target,
    title: "Objectives",
    description: "Monitor objectives, progress, and follow-up actions.",
  },
];

export default function Hero({ onLoginClick }: HeroProps) {
  return (
    <>
      {/* Hero */}
      <section
        className={`${poppins.className} relative overflow-hidden bg-[linear-gradient(115deg,#0E1016_0%,#201A22_32%,#5A3630_62%,#C97448_100%)] px-6 pt-24 text-left lg:pl-[65px] lg:pr-6`}
      >
        {/* Background glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[60px] -top-[60px] h-[320px] w-[320px] rounded-full bg-[#FFDCC0]/[0.18] blur-[80px]"
        />

        {/* Content */}
        <div className="relative z-10 mx-auto flex min-h-[720px] w-full max-w-[1400px] flex-col items-start justify-center pb-[80px]">
          
          {/* Eyebrow */}
          <div className="mb-7 flex items-center gap-[14px]">
            


          </div>

          {/* Heading */}
          <h1 className="w-full max-w-[760px] text-[58px] font-bold uppercase leading-[0.98] tracking-[-0.01em] text-[#EDEFF2] sm:text-[68px] md:text-[76px] lg:text-[80px]">
            Every risk,
            <br />
            KPI, and
            <br />
            objective
            <br />
            in one place.
          </h1>

          {/* Description */}
          <p className="mt-8 mb-10 max-w-[620px] text-base font-normal leading-[1.7] text-[#B8BEC7] sm:text-lg">
            Department teams report performance directly. IMS monitors it all
            from a single view no more piecing it together from scattered
            sheets before every audit.
          </p>

          {/* Button */}
          <Button
            type="button"
            onClick={onLoginClick}
            className="h-auto rounded-[10px] border-0 bg-[#E1573C] px-[34px] py-[18px] text-[17px] font-semibold text-white shadow-[0_4px_16px_rgba(225,87,60,0.12)] transition-all duration-200 hover:-translate-y-px hover:bg-[#C94B35] hover:shadow-[0_8px_24px_rgba(225,87,60,0.22)]"
          >
            Start now
            
          </Button>
        </div>
      </section>

      {/* Orange → Cream angled transition */}
      <div className="relative -mt-[1px] bg-[#E1573C]">
        <svg
          viewBox="0 0 1200 90"
          preserveAspectRatio="none"
          className="block h-[120px] w-full"
          aria-hidden="true"
        >
          <polygon
            points="0,90 0,55 700,0 1200,45 1200,90"
            fill="#F6F4EF"
          />
        </svg>
      </div>

      {/* Features */}
      <section className="bg-[#F6F4EF] px-6 pb-[100px] pt-2 text-[#22252A] lg:px-[65px]">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-12 md:grid-cols-3">
          {FEATURES.map((item) => {
           

            return (
              <div key={item.title}>
                <div className="mb-4 flex items-center gap-3">
        

                  <h3 className="font-sans text-xl font-semibold text-[#22252A]">
                    {item.title}
                  </h3>
                </div>

                <p className="m-0 max-w-[360px] text-[15px] leading-[1.6] text-[#6B6E76]">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}