import React from "react";
import { Logo } from "../custom/Logo";
import { motion } from "framer-motion";
import { Building2, Handshake, Laptop } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        backgroundColor: "var(--auth-background)",
      }}
    >
      {/* Left Side - Form */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          flex: "0 0 45%",
          maxWidth: "650px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "4rem 2rem 3rem 2rem",
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: "480px" }}>
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              marginBottom: "1.5rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "150px",
            }}
          >
            <Logo size="md" />
          </motion.div>

          {/* Title & Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{ marginBottom: "0.5rem" }}
          >
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: 600,
                color: "var(--auth-text)",
                marginBottom: "0.5rem",
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  color: "var(--auth-text-muted)",
                  fontSize: "1rem",
                }}
              >
                {subtitle}
              </p>
            )}
          </motion.div>

          {/* Form Content */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Brand Panel */}
      <div
        style={{
          flex: "1",
          background:
            "linear-gradient(135deg, #14B8A6 0%, #0D9488 50%, #0F766E 100%)",
          alignItems: "center",
          justifyContent: "center",
          padding: "4rem 3rem",
          position: "relative",
          overflow: "hidden",
          display: "flex",
        }}
      >
        {/* Animated Background Elements */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.1)",
            top: "-100px",
            right: "-100px",
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.05)",
            bottom: "-50px",
            left: "-50px",
          }}
        />

        <div
          style={{
            textAlign: "center",
            color: "white",
            position: "relative",
            zIndex: 1,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2
              style={{
                fontSize: "2.5rem",
                fontWeight: 700,
                marginBottom: "1.5rem",
              }}
            >
              SME-Freelancer Connect
            </h2>
            <p
              style={{
                fontSize: "1.25rem",
                opacity: 0.9,
                lineHeight: 1.6,
                maxWidth: "500px",
              }}
            >
              Connecting Small Businesses with Talented Developers through
              Professional Brokers
            </p>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            style={{
              marginTop: "3rem",
              display: "grid",
              gap: "1rem",
            }}
          >
            {[
              {
                icon: Building2,
                text: "For SME Owners",
                bg: "rgba(147, 197, 253, 0.2)",
              },
              {
                icon: Handshake,
                text: "For Brokers",
                bg: "rgba(191, 219, 254, 0.15)",
              },
              {
                icon: Laptop,
                text: "For Freelancers",
                bg: "rgba(219, 234, 254, 0.15)",
              },
            ].map((item, index) => {
              const IconComponent = item.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{
                    opacity: 1,
                    x: 0, // [0, 10, 0, -5, 0],
                    y: 0, // [0, -20, -15, -25, 0],
                    scale: 1, // [1, 1.08, 1.05, 1.1, 1],
                    rotate: 0, // [0, 2, -1, 3, 0],
                  }}
                  transition={{
                    opacity: { duration: 0.5, delay: 0.7 + index * 0.1 },
                    x: {
                      duration: 0.5, // 3.5,
                      delay: 1.2 + index * 0.4,
                      // repeat: Infinity,
                      // repeatDelay: 1.5,
                      ease: "easeOut", // [0.43, 0.13, 0.23, 0.96],
                    },
                    y: {
                      duration: 0.5, // 3.5,
                      delay: 1.2 + index * 0.4,
                      // repeat: Infinity,
                      // repeatDelay: 1.5,
                      ease: "easeOut", // [0.43, 0.13, 0.23, 0.96],
                    },
                    scale: {
                      duration: 0.5, // 3.5,
                      delay: 1.2 + index * 0.4,
                      // repeat: Infinity,
                      // repeatDelay: 1.5,
                      ease: "easeOut", // [0.43, 0.13, 0.23, 0.96],
                    },
                    rotate: {
                      duration: 0.5, // 3.5,
                      delay: 1.2 + index * 0.4,
                      // repeat: Infinity,
                      // repeatDelay: 1.5,
                      ease: "easeOut", // [0.43, 0.13, 0.23, 0.96],
                    },
                  }}
                  whileHover={{
                    scale: 1.12,
                    x: 10,
                    rotate: 5,
                    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
                    transition: { duration: 0.3 },
                  }}
                  style={{
                    backgroundColor: item.bg,
                    backdropFilter: "blur(10px)",
                    padding: "1.25rem 1.75rem",
                    borderRadius: "16px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    gap: "1.25rem",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "2.5rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "60px",
                      height: "60px",
                      borderRadius: "12px",
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                    }}
                  >
                    <IconComponent
                      className="w-10 h-10"
                      style={{ color: "white" }}
                    />
                  </div>
                  <span style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                    {item.text}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
