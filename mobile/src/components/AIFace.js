import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { colors } from '../constants/colors';

const STATE_CONFIG = {
  idle:       { iris: colors.primary,   squintY: 1,    glowColor: colors.primary   },
  listening:  { iris: '#52D4C0',        squintY: 1.08, glowColor: '#52D4C0'        },
  processing: { iris: '#9B72E8',        squintY: 0.42, glowColor: '#9B72E8'        },
  speaking:   { iris: colors.secondary, squintY: 1,    glowColor: colors.secondary },
};

function Eye({ scaleY, glowOpacity, glowColor, irisColor, irisScale, pupilX, pupilY, eyeSize, irisSize, pupilSize }) {
  const glowSize = eyeSize + 16;
  return (
    <View style={{ width: glowSize, height: glowSize, alignItems: 'center', justifyContent: 'center' }}>
      {/* Soft glow halo */}
      <Animated.View style={{
        position: 'absolute',
        width: glowSize, height: glowSize,
        borderRadius: glowSize / 2,
        backgroundColor: glowColor,
        opacity: glowOpacity,
      }}/>
      {/* White eyeball */}
      <Animated.View style={{
        width: eyeSize, height: eyeSize,
        borderRadius: eyeSize / 2,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E0E8F4',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scaleY }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
      }}>
        {/* Colored iris — native scale */}
        <Animated.View style={{
          width: irisSize, height: irisSize,
          borderRadius: irisSize / 2,
          backgroundColor: irisColor,
          transform: [{ scale: irisScale }],
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Dark pupil — native translate */}
          <Animated.View style={{
            width: pupilSize, height: pupilSize,
            borderRadius: pupilSize / 2,
            backgroundColor: '#111',
            transform: [{ translateX: pupilX }, { translateY: pupilY }],
          }}>
            {/* Highlight sparkle */}
            <View style={{
              position: 'absolute',
              width: pupilSize * 0.32, height: pupilSize * 0.32,
              borderRadius: pupilSize * 0.16,
              backgroundColor: 'rgba(255,255,255,0.82)',
              top: pupilSize * 0.12, left: pupilSize * 0.12,
            }}/>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function Mouth({ state, mini }) {
  const W    = mini ? 13 : 32;
  const arcH = mini ? 6  : 14;
  const bw   = mini ? 2  : 2.5;
  if (state === 'processing') {
    return <View style={{ width: W * 0.7, height: bw, borderRadius: bw, backgroundColor: '#9B72E8', marginTop: mini ? 5 : 10 }}/>;
  }
  const c = state === 'speaking' ? colors.secondary : state === 'listening' ? '#52D4C0' : colors.primary;
  return (
    <View style={{
      width: W, height: arcH, borderRadius: W / 2, borderWidth: bw,
      borderTopColor: 'transparent', borderLeftColor: c, borderRightColor: c, borderBottomColor: c,
      marginTop: mini ? 3 : 8,
    }}/>
  );
}

export default function AIFace({ micState = 'idle', mini = false }) {
  const EYE_SIZE   = mini ? 22 : 44;
  const IRIS_SIZE  = mini ? 13 : 26;
  const PUPIL_SIZE = mini ? 5  : 11;
  const MAX_PUPIL  = mini ? 3  : 6;

  // All transform/opacity anims — native driver where possible
  const leftScaleY  = useRef(new Animated.Value(1)).current;
  const rightScaleY = useRef(new Animated.Value(1)).current;
  const irisScale   = useRef(new Animated.Value(1)).current;
  const pupilX      = useRef(new Animated.Value(0)).current;
  const pupilY      = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const loopRef       = useRef(null);
  const blinkRef      = useRef(null);
  const driftRef      = useRef(null);
  const faceRef       = useRef(null);
  const faceCenterRef = useRef({ x: 0, y: 0 });
  const trackingRef   = useRef(true);

  // Web mouse tracking
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => {
      if (!trackingRef.current) return;
      const { x: cx, y: cy } = faceCenterRef.current;
      if (!cx || !cy) return;
      const tx = Math.max(-MAX_PUPIL, Math.min(MAX_PUPIL, ((e.pageX - cx) / 80) * MAX_PUPIL));
      const ty = Math.max(-MAX_PUPIL, Math.min(MAX_PUPIL, ((e.pageY - cy) / 80) * MAX_PUPIL));
      Animated.parallel([
        Animated.spring(pupilX, { toValue: tx, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.spring(pupilY, { toValue: ty, useNativeDriver: true, tension: 120, friction: 10 }),
      ]).start();
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const stopAll = () => {
    loopRef.current?.stop(); loopRef.current = null;
    clearTimeout(blinkRef.current); blinkRef.current = null;
    clearTimeout(driftRef.current); driftRef.current = null;
  };

  const doBlink = (onDone) => {
    const isDouble = Math.random() < 0.25;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(leftScaleY,  { toValue: 0.05, duration: 90,  useNativeDriver: true }),
        Animated.timing(rightScaleY, { toValue: 0.05, duration: 90,  useNativeDriver: true }),
      ]),
      Animated.delay(50),
      Animated.parallel([
        Animated.timing(leftScaleY,  { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(rightScaleY, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]),
      ...(isDouble ? [
        Animated.delay(80),
        Animated.parallel([
          Animated.timing(leftScaleY,  { toValue: 0.05, duration: 80, useNativeDriver: true }),
          Animated.timing(rightScaleY, { toValue: 0.05, duration: 80, useNativeDriver: true }),
        ]),
        Animated.delay(45),
        Animated.parallel([
          Animated.timing(leftScaleY,  { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(rightScaleY, { toValue: 1, duration: 90, useNativeDriver: true }),
        ]),
      ] : []),
    ]).start(onDone);
  };

  const scheduleIdleBlink = () => {
    blinkRef.current = setTimeout(() => doBlink(() => scheduleIdleBlink()), 1400 + Math.random() * 2400);
  };

  const scheduleIdleDrift = () => {
    if (Platform.OS === 'web') return;
    driftRef.current = setTimeout(() => {
      const tx = (Math.random() - 0.5) * MAX_PUPIL * 1.2;
      const ty = (Math.random() - 0.5) * MAX_PUPIL * 0.7;
      Animated.parallel([
        Animated.timing(pupilX, { toValue: tx, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pupilY, { toValue: ty, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start(() => scheduleIdleDrift());
    }, 1000 + Math.random() * 2000);
  };

  useEffect(() => {
    stopAll();
    const cfg = STATE_CONFIG[micState] || STATE_CONFIG.idle;

    if (micState === 'idle') {
      trackingRef.current = true;
      Animated.parallel([
        Animated.timing(leftScaleY,  { toValue: 1,    duration: 240, useNativeDriver: true }),
        Animated.timing(rightScaleY, { toValue: 1,    duration: 240, useNativeDriver: true }),
        Animated.timing(irisScale,   { toValue: 1,    duration: 240, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0,    duration: 300, useNativeDriver: true }),
      ]).start(() => { scheduleIdleBlink(); scheduleIdleDrift(); });
    }

    if (micState === 'listening') {
      trackingRef.current = true;
      Animated.parallel([
        Animated.timing(leftScaleY,  { toValue: cfg.squintY, duration: 240, useNativeDriver: true }),
        Animated.timing(rightScaleY, { toValue: cfg.squintY, duration: 240, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.28,        duration: 360, useNativeDriver: true }),
      ]).start();
      loopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(irisScale, { toValue: 1.12, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(irisScale, { toValue: 0.92, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loopRef.current.start();
      const blink = () => { blinkRef.current = setTimeout(() => doBlink(blink), 2200 + Math.random() * 2000); };
      blink();
    }

    if (micState === 'processing') {
      trackingRef.current = false;
      Animated.parallel([
        Animated.timing(leftScaleY,  { toValue: cfg.squintY, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rightScaleY, { toValue: cfg.squintY, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(irisScale,   { toValue: 0.88,        duration: 320, useNativeDriver: true }),
        Animated.timing(pupilY,      { toValue: mini ? -2 : -3, duration: 320, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.22,        duration: 300, useNativeDriver: true }),
      ]).start();
      loopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pupilX, { toValue: -MAX_PUPIL,       duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pupilX, { toValue:  MAX_PUPIL,       duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pupilX, { toValue: -MAX_PUPIL * 0.3, duration: 420, useNativeDriver: true }),
        Animated.timing(pupilX, { toValue: 0,                duration: 340, useNativeDriver: true }),
        Animated.delay(220),
      ]));
      loopRef.current.start();
    }

    if (micState === 'speaking') {
      trackingRef.current = true;
      Animated.parallel([
        Animated.timing(leftScaleY,  { toValue: 1,    duration: 220, useNativeDriver: true }),
        Animated.timing(rightScaleY, { toValue: 1,    duration: 220, useNativeDriver: true }),
        Animated.timing(irisScale,   { toValue: 1,    duration: 220, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.22, duration: 300, useNativeDriver: true }),
      ]).start();
      loopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(irisScale, { toValue: 1.06, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(irisScale, { toValue: 0.96, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loopRef.current.start();
      const blink = () => { blinkRef.current = setTimeout(() => doBlink(blink), 1800 + Math.random() * 2600); };
      blink();
    }

    return () => stopAll();
  }, [micState]);

  const cfg = STATE_CONFIG[micState] || STATE_CONFIG.idle;
  const gap = mini ? 6 : 14;

  return (
    <View
      ref={faceRef}
      onLayout={() => {
        faceRef.current?.measure?.((x, y, w, h, px, py) => {
          faceCenterRef.current = { x: px + w / 2, y: py + h / 2 };
        });
      }}
      style={[styles.face, { gap }]}
    >
      <View style={[styles.eyesRow, { gap }]}>
        <Eye
          scaleY={leftScaleY}
          glowOpacity={glowOpacity}
          glowColor={cfg.glowColor}
          irisColor={cfg.iris}
          irisScale={irisScale}
          pupilX={pupilX}
          pupilY={pupilY}
          eyeSize={EYE_SIZE}
          irisSize={IRIS_SIZE}
          pupilSize={PUPIL_SIZE}
        />
        <Eye
          scaleY={rightScaleY}
          glowOpacity={glowOpacity}
          glowColor={cfg.glowColor}
          irisColor={cfg.iris}
          irisScale={irisScale}
          pupilX={pupilX}
          pupilY={pupilY}
          eyeSize={EYE_SIZE}
          irisSize={IRIS_SIZE}
          pupilSize={PUPIL_SIZE}
        />
      </View>
      <Mouth state={micState} mini={mini} />
    </View>
  );
}

const styles = StyleSheet.create({
  face:    { alignItems: 'center', justifyContent: 'center' },
  eyesRow: { flexDirection: 'row', alignItems: 'center' },
});
