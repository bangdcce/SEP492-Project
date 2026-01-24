import { useState, useEffect } from "react";
import * as Slider from "@radix-ui/react-slider";

interface MoneySplitSliderProps {
  totalAmount: number;
  onChange?: (split: {
    client: number;
    freelancer: number;
    fee: number;
    clientPercent: number;
    freelancerPercent: number;
  }) => void;
}

export const MoneySplitSlider = ({
  totalAmount,
  onChange,
}: MoneySplitSliderProps) => {
  const [freelancerPercent, setFreelancerPercent] = useState(50);

  // Constants from backend config
  const PLATFORM_FEE_PERCENT = 0.05; // 5%

  // Calculations
  const freelancerGross = (totalAmount * freelancerPercent) / 100;
  const platformFee = freelancerGross * PLATFORM_FEE_PERCENT; // Fee usually taken from Freelancer earnings
  const freelancerNet = freelancerGross - platformFee;
  const clientAmount = totalAmount - freelancerGross;
  const clientPercent = 100 - freelancerPercent;

  useEffect(() => {
    onChange?.({
      client: clientAmount,
      freelancer: freelancerNet,
      fee: platformFee,
      clientPercent,
      freelancerPercent,
    });
  }, [freelancerPercent, totalAmount, clientAmount, freelancerNet, platformFee, clientPercent, onChange]);

  return (
    <div className="space-y-6 select-none touch-none">
      {/* Visual Number Display */}
      <div className="flex justify-between items-end">
        <div className="text-left">
          <p className="text-sm font-medium text-gray-500">Refund to Client</p>
          <p className="text-3xl font-bold text-slate-900">
            ${clientAmount.toFixed(2)}
          </p>
          <p className="text-xs text-green-600 font-medium">
            {100 - freelancerPercent}%
          </p>
        </div>

        <div className="text-center pb-2">
          <p className="text-xs text-gray-400">Total Escrow</p>
          <p className="text-sm font-semibold text-gray-600">
            ${totalAmount.toFixed(2)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-gray-500">
            Release to Freelancer
          </p>
          <p className="text-3xl font-bold text-teal-600">
            ${freelancerNet.toFixed(2)}
          </p>
          <div className="text-xs text-gray-400 flex justify-end gap-1">
            <span className="font-medium text-teal-600">
              {freelancerPercent}%
            </span>
            <span>(-${platformFee.toFixed(2)} Fee)</span>
          </div>
        </div>
      </div>

      {/* The Slider */}
      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-10 cursor-pointer group"
        value={[freelancerPercent]}
        max={100}
        step={1}
        onValueChange={(val) => setFreelancerPercent(val[0])}
      >
        <Slider.Track className="bg-slate-200 relative grow rounded-full h-4 overflow-hidden">
          {/* Background is client (Slate), Range is Freelancer (Teal) */}
          <Slider.Range className="absolute bg-teal-500 h-full" />
        </Slider.Track>
        <Slider.Thumb
          className="block w-8 h-8 bg-white border-4 border-teal-600 shadow-lg rounded-full hover:scale-110 focus:outline-none focus:ring-4 focus:ring-teal-500/30 transition-transform"
          aria-label="Split Percentage"
        >
          <div className="flex items-center justify-center w-full h-full">
            <div className="w-1 h-3 bg-gray-300 rounded-full mx-[1px]" />
            <div className="w-1 h-3 bg-gray-300 rounded-full mx-[1px]" />
          </div>
        </Slider.Thumb>
      </Slider.Root>

      <p className="text-center text-xs text-gray-400 italic">
        Drag slider to adjust the split accurately.
      </p>
    </div>
  );
};
