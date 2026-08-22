import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const WELCOMED_KEY = 'oxygenclaw:welcomed';

const FEATURES = [
  { label: 'Multi-Model Playground', desc: '统一接口，调度任意 LLM' },
  { label: 'Agent Workflows', desc: '可视化编排多步推理' },
  { label: 'MCP Integration', desc: '原生协议，连接外部能力' },
];

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);

  const enter = useCallback(() => {
    localStorage.setItem(WELCOMED_KEY, String(Date.now()));
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase(1), 200),
      window.setTimeout(() => setPhase(2), 900),
      window.setTimeout(() => setPhase(3), 1500),
      window.setTimeout(() => setPhase(4), 2100),
      window.setTimeout(() => setPhase(5), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') enter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enter]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--md-background)',
        color: 'var(--md-on-background)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* 顶部细线 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'var(--md-outline-variant)',
          transformOrigin: 'left center',
          transform: phase >= 1 ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 1.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* 角落元信息 */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 40,
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--md-on-surface-variant)',
          opacity: phase >= 2 ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        OxygenClaw · v26
      </div>
      <div
        style={{
          position: 'absolute',
          top: 32,
          right: 40,
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--md-on-surface-variant)',
          opacity: phase >= 2 ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        An Oxygen-Origin Project
      </div>

      {/* 中央主视觉 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
        }}
      >
        {/* O₂ 艺术符号 */}
        <div
          style={{
            position: 'relative',
            marginBottom: 48,
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'scale(1)' : 'scale(0.92)',
            transition: 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            style={{
              fontSize: 140,
              fontWeight: 200,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              color: 'var(--md-on-background)',
              fontFamily: "'Inter', sans-serif",
              display: 'flex',
              alignItems: 'flex-start',
            }}
          >
            O
            <span style={{ fontSize: 56, fontWeight: 300, marginTop: 18, marginLeft: 4 }}>₂</span>
          </div>
          {/* 描边圆环 */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 220,
              height: 220,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `1px solid var(--md-outline)`,
              opacity: 0.5,
              animation: 'oc-breathe 4s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 280,
              height: 280,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `1px solid var(--md-outline-variant)`,
              opacity: 0.4,
              animation: 'oc-breathe 4s ease-in-out infinite 0.6s',
            }}
          />
        </div>

        {/* 品牌名 */}
        <h1
          style={{
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            marginBottom: 16,
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          OxygenClaw
        </h1>

        {/* 概要标语 */}
        <p
          style={{
            fontSize: 16,
            fontWeight: 300,
            color: 'var(--md-on-surface-variant)',
            maxWidth: 520,
            textAlign: 'center',
            lineHeight: 1.7,
            marginBottom: 64,
            opacity: phase >= 3 ? 1 : 0,
            transform: phase >= 3 ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          一个为多模型推理、智能体协作与工具协议而生的统一工作台。
          在极简的界面之下，连接任意 LLM、编排复杂工作流、原生接入 MCP。
        </p>

        {/* 特性列 */}
        <div
          style={{
            display: 'flex',
            gap: 56,
            marginBottom: 80,
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.label} style={{ textAlign: 'center', maxWidth: 160 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 6,
                  color: 'var(--md-on-background)',
                }}
              >
                {f.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 300,
                  color: 'var(--md-on-surface-variant)',
                  lineHeight: 1.5,
                }}
              >
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        {/* 进入按钮 */}
        <button
          onClick={enter}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 28px',
            background: 'var(--md-on-background)',
            color: 'var(--md-background)',
            border: 'none',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '0.01em',
            cursor: 'pointer',
            opacity: phase >= 5 ? 1 : 0,
            transform: phase >= 5 ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, filter 0.2s ease',
            boxShadow: 'var(--md-elevation-2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(0.92)';
            e.currentTarget.style.boxShadow = 'var(--md-elevation-3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'brightness(1)';
            e.currentTarget.style.boxShadow = 'var(--md-elevation-2)';
          }}
        >
          开始探索
          <ArrowRight size={16} strokeWidth={2} />
        </button>
      </div>

      {/* 底部细线 + 提示 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'var(--md-outline-variant)',
          transformOrigin: 'right center',
          transform: phase >= 2 ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--md-on-surface-variant)',
          opacity: phase >= 5 ? 0.6 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        Press Enter to continue
      </div>

      <style>{`
        @keyframes oc-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1.04); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
