import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  return (
    <AuthLayout
      icon={MessageCircle}
      title="Reset password"
      subtitle="Contact support to regain access"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      <div className="border hairline p-6 text-center space-y-4 bg-muted/10 mt-2">
        <p className="text-sm text-muted-foreground leading-relaxed">
          For security reasons, password resets are handled securely by our support team.
        </p>
        
        <div className="pt-4 pb-2">
          <a
            href="https://t.me/your_telegram_username" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full h-12 bg-[#2AABEE] text-white font-medium hover:opacity-90 transition-opacity rounded-md"
          >
            {/* Telegram Icon SVG */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.18-5.21 3.45-.49.34-.94.51-1.35.5-.45-.01-1.32-.26-1.96-.47-.79-.26-1.42-.4-1.37-.85.03-.23.32-.47.88-.72 3.45-1.5 5.76-2.5 6.92-2.98 3.29-1.38 3.98-1.62 4.43-1.63.1 0 .32.02.44.11.1.08.13.19.14.28.01.07.01.15 0 .22z"/>
            </svg>
            Contact via Telegram
          </a>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Please provide your registered email address and phone number when messaging.
        </p>
      </div>
    </AuthLayout>
  );
}