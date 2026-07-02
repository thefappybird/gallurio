"use client";

import { motion } from "motion/react";

const stroke = "currentColor";

export function BusinessIllustration() {
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full max-w-[360px] text-foreground" fill="none">
      <motion.rect
        x="40"
        y="80"
        width="240"
        height="180"
        stroke={stroke}
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.line
        x1="40"
        y1="120"
        x2="280"
        y2="120"
        stroke={stroke}
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      />
      <motion.circle
        cx="60"
        cy="100"
        r="4"
        fill={stroke}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5 }}
      />
      <motion.circle
        cx="76"
        cy="100"
        r="4"
        fill={stroke}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6 }}
      />
      <motion.circle
        cx="92"
        cy="100"
        r="4"
        fill={stroke}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.7 }}
      />
      <motion.rect
        x="64"
        y="146"
        width="80"
        height="10"
        fill={stroke}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        style={{ originX: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
      />
      <motion.rect
        x="64"
        y="170"
        width="180"
        height="6"
        fill={stroke}
        opacity="0.4"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        style={{ originX: 0 }}
        transition={{ delay: 0.95, duration: 0.5 }}
      />
      <motion.rect
        x="64"
        y="186"
        width="140"
        height="6"
        fill={stroke}
        opacity="0.4"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        style={{ originX: 0 }}
        transition={{ delay: 1.05, duration: 0.5 }}
      />
      <motion.rect
        x="64"
        y="216"
        width="60"
        height="22"
        stroke={stroke}
        strokeWidth="2"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      />
    </svg>
  );
}

export function TemplateIllustration() {
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full max-w-[360px] text-foreground" fill="none">
      {[0, 1, 2].map((i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 * i + 0.1 }}
        >
          <rect
            x={40 + i * 80}
            y={60 + i * 10}
            width="60"
            height="200"
            stroke={stroke}
            strokeWidth="2"
          />
          <rect x={48 + i * 80} y={68 + i * 10} width="44" height="44" fill={stroke} opacity={0.15} />
          <rect x={48 + i * 80} y={120 + i * 10} width="44" height="6" fill={stroke} opacity={0.4} />
          <rect x={48 + i * 80} y={132 + i * 10} width="32" height="6" fill={stroke} opacity={0.25} />
          <rect x={48 + i * 80} y={156 + i * 10} width="44" height="80" fill={stroke} opacity={0.08} />
        </motion.g>
      ))}
    </svg>
  );
}

export function PaymentsIllustration() {
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full max-w-[360px] text-foreground" fill="none">
      <motion.rect
        x="50"
        y="100"
        width="220"
        height="130"
        stroke={stroke}
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.rect
        x="50"
        y="125"
        width="220"
        height="24"
        fill={stroke}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        style={{ originX: 0 }}
        transition={{ delay: 0.5 }}
      />
      <motion.rect
        x="64"
        y="170"
        width="60"
        height="8"
        fill={stroke}
        opacity="0.5"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        style={{ originX: 0 }}
        transition={{ delay: 0.8 }}
      />
      <motion.rect
        x="64"
        y="186"
        width="100"
        height="14"
        fill={stroke}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        style={{ originX: 0 }}
        transition={{ delay: 0.95 }}
      />
      <motion.g
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1 }}
      >
        <rect x="210" y="180" width="44" height="28" stroke={stroke} strokeWidth="2" />
        <line x1="220" y1="194" x2="244" y2="194" stroke={stroke} strokeWidth="2" />
      </motion.g>
    </svg>
  );
}

export function PlanIllustration() {
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full max-w-[360px] text-foreground" fill="none">
      {[0, 1].map((i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.15 }}
        >
          <rect
            x={50 + i * 120}
            y={70}
            width="100"
            height="180"
            stroke={stroke}
            strokeWidth="2"
            fill={i === 1 ? stroke : "transparent"}
            fillOpacity={i === 1 ? 0.06 : 1}
          />
          <text
            x={100 + i * 120}
            y={110}
            fill={stroke}
            fontSize="14"
            textAnchor="middle"
            fontFamily="inherit"
          >
            {i === 0 ? "Free" : "Pro"}
          </text>
          <text
            x={100 + i * 120}
            y={150}
            fill={stroke}
            fontSize="24"
            textAnchor="middle"
            fontFamily="inherit"
            fontWeight="600"
          >
            {i === 0 ? "₱0" : "₱250"}
          </text>
          {[180, 200, 220].map((y) => (
            <rect
              key={y}
              x={66 + i * 120}
              y={y}
              width="68"
              height="4"
              fill={stroke}
              opacity={0.3}
            />
          ))}
        </motion.g>
      ))}
    </svg>
  );
}

export function DoneIllustration() {
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full max-w-[360px] text-foreground" fill="none">
      <motion.circle
        cx="160"
        cy="160"
        r="80"
        stroke={stroke}
        strokeWidth="2"
        initial={{ pathLength: 0, scale: 0.9 }}
        animate={{ pathLength: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d="M125 165 L150 190 L200 135"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="square"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.rect
          key={i}
          x={70 + i * 40}
          y={260}
          width="6"
          height="6"
          fill={stroke}
          initial={{ y: 280, opacity: 0 }}
          animate={{ y: 260, opacity: 1 }}
          transition={{ delay: 1 + i * 0.1, duration: 0.4 }}
        />
      ))}
    </svg>
  );
}
