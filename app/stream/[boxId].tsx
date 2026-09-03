// The capture screen (Claude Design "Streaming Mode Prototype"). Two views of ONE
// screen, flipped in place (no extra navigation — one X closes everything):
//   • capture (free): snap one item → name it in Add-item, one at a time. A
//     "Switch to Stream" pill flips to stream (Pro; free users see the upsell).
//   • stream (Pro): rapid session — Photos-on (snap → say one item) or Photos-off
//     (talk a whole box in at once) → ledger (tap to fix) → Done commits via addItem.
// Dictation is simulated for now (lib/dictation); the on-device mic swaps in later.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Button, Icon, Sheet, StreamUpsell } from '@/components';
import { listen, isDictationSimulated, type DictationSession } from '@/lib/dictation';
import { money } from '@/lib/money';
import { persistCapture } from '@/lib/photos';
import { iconFor, parseList, parseUtterance } from '@/lib/streamParse';
import { uid } from '@/lib/uid';
import { isProNow, useStore } from '@/store/useStore';
import { boxColor, boxTint, colors, fonts, palette } from '@/theme';

type SItem = {
  id: string;
  name: string;
  qty: number | null;
  value: number | null;
  icon: string;
  needsFix: boolean;
  boxId: string;
  photo?: string | null;
};
type Mic = 'ready' | 'listening' | 'gotit' | 'fail';

export default function StreamSession() {
  const { boxId: initialBoxId, view: initialView } = useLocalSearchParams<{ boxId: string; view?: string }>();
  const boxes = useStore((s) => s.boxes);
  const isPro = useStore(isProNow);
  const signedIn = useStore((s) => s.session != null);
  const startProTrial = useStore((s) => s.startProTrial);

  const [boxId, setBoxId] = useState<string>(initialBoxId ?? boxes[0]?.id ?? '');
  // Free users always start in capture view — stream is Pro-only, reachable only through
  // the gated "Switch to Stream" pill / upsell. This also clamps a `?view=stream` deep
  // link so it can't drop a free user into the Pro session, bypassing the paywall.
  const [view, setView] = useState<'capture' | 'stream'>(() =>
    initialView !== 'capture' && isProNow(useStore.getState()) ? 'stream' : 'capture',
  );
  const [session, setSession] = useState<SItem[]>([]);
  const [mic, setMic] = useState<Mic>('ready');
  const [transcript, setTranscript] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [torch, setTorch] = useState(false);
  const [flash, setFlash] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lastBatch, setLastBatch] = useState(0);

  const dictRef = useRef<DictationSession | null>(null);
  const gotitTmo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTmo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBatchIds = useRef<string[]>([]);
  const targetRef = useRef<string | null>(null);
  const listModeRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const pendingPhoto = useRef<string | null>(null);
  const captureSeq = useRef(0); // matches an async photo to the capture that started it
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const simulated = isDictationSimulated();

  useEffect(() => {
    if (!camPerm?.granted && camPerm?.canAskAgain) void requestCamPerm();
  }, [camPerm?.granted, camPerm?.canAskAgain, requestCamPerm]);

  useEffect(
    () => () => {
      dictRef.current?.cancel();
      if (gotitTmo.current) clearTimeout(gotitTmo.current);
      if (flashTmo.current) clearTimeout(flashTmo.current);
    },
    [],
  );

  // Take a photo (best-effort) and stash it for the item the next utterance creates.
  // The seq guard ensures a slow capture can't attach to a later item.
  const capturePhoto = async (seq: number) => {
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) {
        const ref = await persistCapture(pic.uri);
        if (seq === captureSeq.current) pendingPhoto.current = ref;
      }
    } catch (e) {
      console.warn('stream: photo capture failed', e); // item is still captured by voice
    }
  };

  // Switching mode or view invalidates any in-flight / pending photo, so a slow stream
  // capture can't attach to a later item after a flip.
  useEffect(() => {
    pendingPhoto.current = null;
    captureSeq.current += 1;
  }, [voiceMode, view]);

  const photoMode = !voiceMode;
  // Camera is live in capture view, and in stream view only with Photos on.
  const cameraOn = !!camPerm?.granted && (view === 'capture' || photoMode);
  const box = boxes.find((b) => b.id === boxId) ?? boxes[0];
  const lastIt = session.find((it) => it.id === lastId) ?? null;
  const editIt = session.find((it) => it.id === editId) ?? null;
  const sessionValue = useMemo(
    () => session.reduce((a, it) => a + (it.value || 0) * (it.qty || 1), 0),
    [session],
  );
  const fixCount = session.filter((it) => it.needsFix).length;

  const boxLabel = (b?: { number: number; name: string }) => (b ? `Box #${b.number} · ${b.name}` : 'Box');
  const colorOf = (id: string) => boxes.find((b) => b.id === id)?.color ?? box?.color ?? 'green';
  const metaOf = (it: SItem) => {
    const parts: string[] = [];
    if (it.qty && it.qty > 1) parts.push('×' + it.qty);
    if (it.value != null) parts.push(money(it.value));
    return parts.join(' · ') || 'No value yet';
  };

  const scheduleReady = () => {
    if (gotitTmo.current) clearTimeout(gotitTmo.current);
    gotitTmo.current = setTimeout(() => setMic((m) => (m === 'listening' ? m : 'ready')), 2000);
  };

  const beginListen = (targetId: string | null, listMode = false) => {
    targetRef.current = targetId;
    listModeRef.current = listMode;
    setMic('listening');
    setTranscript('');
    setLastBatch(0);
    dictRef.current?.cancel();
    dictRef.current = listen(
      { listMode },
      {
        onInterim: (t) => setTranscript(t),
        onFinal: (t) => {
          dictRef.current = null;
          finalize(t);
        },
        onError: (e) => {
          // Only the mic/speech-permission denial needs special handling — it must NOT
          // create a fake item. Genuine recognition errors are followed by onEnd →
          // finalize, which captures whatever was heard, so we let those fall through.
          if (!(e instanceof Error && e.message === 'PERMISSION')) return;
          dictRef.current = null;
          if (gotitTmo.current) clearTimeout(gotitTmo.current);
          targetRef.current = null;
          listModeRef.current = false;
          setTranscript('');
          setMic('ready');
          Alert.alert(
            'Microphone access needed',
            'Tuck needs microphone and speech access to add items by voice. Turn them on in Settings › Tuck, then try again.',
          );
        },
      },
    );
  };

  const finalizeList = (raw: string) => {
    listModeRef.current = false;
    const parsed = parseList(raw);
    if (gotitTmo.current) clearTimeout(gotitTmo.current);
    if (!parsed.length) {
      setMic('fail');
      setTranscript('');
      scheduleReady();
      return;
    }
    const batch: SItem[] = parsed.map((p) => ({
      id: uid('v'),
      name: p.name,
      qty: p.qty,
      value: p.value,
      icon: iconFor(p.name),
      needsFix: false,
      boxId,
    }));
    lastBatchIds.current = batch.map((b) => b.id);
    setSession((prev) => [...prev, ...batch]);
    setLastId(batch[batch.length - 1].id);
    setMic('gotit');
    setTranscript('');
    setLastBatch(parsed.length);
    scheduleReady();
  };

  const finalize = (raw: string) => {
    if (listModeRef.current) return finalizeList(raw);
    const text = (raw || '').trim();
    const p = text ? parseUtterance(text) : { name: '', qty: null, value: null };
    const target = targetRef.current;
    targetRef.current = null;
    if (target) {
      setSession((prev) =>
        prev.map((it) =>
          it.id === target
            ? {
                ...it,
                name: p.name || it.name,
                qty: p.qty ?? it.qty,
                value: p.value ?? it.value,
                icon: iconFor(p.name || it.name),
                needsFix: !p.name && it.needsFix,
              }
            : it,
        ),
      );
      setLastId(target);
      setMic(p.name ? 'gotit' : 'fail');
    } else {
      const needsFix = !p.name;
      const it: SItem = {
        id: uid('s'),
        name: p.name || 'Untitled item',
        qty: p.qty,
        value: p.value,
        icon: iconFor(p.name),
        needsFix,
        boxId,
        photo: pendingPhoto.current,
      };
      pendingPhoto.current = null;
      setSession((prev) => [...prev, it]);
      setLastId(it.id);
      setMic(needsFix ? 'fail' : 'gotit');
    }
    setTranscript('');
    scheduleReady();
  };

  // The big button: tap to capture, tap again to stop (finish the utterance now).
  const onCapture = () => {
    if (mic === 'listening') {
      dictRef.current?.stop();
      return;
    }
    if (voiceMode) {
      beginListen(null, true);
    } else {
      setFlash(true);
      if (flashTmo.current) clearTimeout(flashTmo.current);
      flashTmo.current = setTimeout(() => setFlash(false), 200);
      pendingPhoto.current = null;
      void capturePhoto((captureSeq.current += 1));
      setTimeout(() => beginListen(null, false), 230);
    }
  };

  // Capture view (free single item): snap → name it in Add-item, one at a time.
  const captureSingle = async () => {
    if (!boxId) return;
    // No camera yet — open the form; it has its own photo + permission UI.
    if (!camPerm?.granted) {
      router.push({ pathname: '/add-item', params: { boxId } });
      return;
    }
    setFlash(true);
    if (flashTmo.current) clearTimeout(flashTmo.current);
    flashTmo.current = setTimeout(() => setFlash(false), 200);
    let photo: string | null = null;
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) photo = await persistCapture(pic.uri);
    } catch (e) {
      console.warn('capture: photo failed', e); // still let them name the item
    }
    router.push({ pathname: '/add-item', params: photo ? { boxId, photo } : { boxId } });
  };
  // Switch to Stream in place (no navigation). Free users get the upsell first.
  const onSwitchToStream = () => {
    if (isPro) setView('stream');
    else setUpsellOpen(true);
  };

  const onResay = () => {
    if (mic === 'listening') return;
    if (voiceMode) {
      const ids = lastBatchIds.current;
      if (!ids.length) return;
      setSession((prev) => prev.filter((it) => !ids.includes(it.id)));
      setLastId(null);
      setLastBatch(0);
      lastBatchIds.current = [];
      beginListen(null, true);
    } else if (lastId) {
      beginListen(lastId, false);
    }
  };

  const onUndo = () => {
    setSession((prev) => prev.filter((it) => it.id !== lastId));
    setLastId(null);
    setMic('ready');
  };

  const patchEdit = (patch: Partial<SItem>) => {
    if (!editId) return;
    setSession((prev) => prev.map((it) => (it.id === editId ? { ...it, ...patch } : it)));
  };

  const closeStream = () => {
    // Stop a live mic first, so a late onFinal can't append a phantom item after the
    // summary's count is computed (and committed by finish()).
    if (mic === 'listening') {
      dictRef.current?.cancel();
      dictRef.current = null;
      setMic('ready');
    }
    if (session.length > 0) setSummaryOpen(true);
    else router.back();
  };

  const finish = () => {
    const add = useStore.getState().addItem;
    for (const it of session) {
      add(it.boxId, {
        name: it.name?.trim() || 'Untitled item',
        qty: it.qty ?? undefined,
        value: it.value ?? undefined,
        icon: it.icon,
        photos: it.photo ? [it.photo] : undefined,
      });
    }
    setSummaryOpen(false);
    router.replace({
      pathname: `/box/${initialBoxId ?? boxId}`,
      params: { streamed: String(session.length) },
    });
  };

  const resayActive = voiceMode ? lastBatchIds.current.length > 0 : !!lastId;
  const boxCount = new Set(session.map((it) => it.boxId)).size;
  const summaryLabel = `${session.length} ${session.length === 1 ? 'item' : 'items'} tucked into ${boxCount} ${boxCount === 1 ? 'box' : 'boxes'} — ${money(sessionValue)} packed.`;

  return (
    <View style={styles.root}>
      {/* Live camera behind capture / photo-mode UI; dark backdrop otherwise. */}
      {cameraOn ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      ) : null}
      {cameraOn ? <View style={styles.camScrim} /> : null}
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={closeStream} accessibilityLabel="End session" style={styles.iconBtn}>
            <Icon name="x" size={19} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.boxChip}>
            <View style={[styles.dot, { backgroundColor: boxColor(box?.color ?? 'green') }]} />
            <Text style={styles.boxChipText} numberOfLines={1}>
              {boxLabel(box)}
            </Text>
            <Icon name="chevron-down" size={15} color="rgba(255,255,255,0.8)" />
          </Pressable>
          {cameraOn ? (
            <Pressable
              onPress={() => setTorch((t) => !t)}
              style={[styles.iconBtn, torch && styles.iconBtnOn]}
              accessibilityLabel={torch ? 'Flash on' : 'Flash off'}
            >
              <Icon name="zap" size={17} color={torch ? palette.ink900 : '#fff'} />
            </Pressable>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        {view === 'capture' ? (
          <>
            {/* Switch to Stream — the Pro upsell, flips in place */}
            <View style={styles.captureSwitchWrap}>
              <Pressable
                onPress={onSwitchToStream}
                style={styles.streamPill}
                accessibilityLabel="Switch to Stream"
              >
                <Icon name="zap" size={17} color={colors.brand} />
                <Text style={styles.streamPillText}>Switch to Stream</Text>
                {!isPro ? (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                ) : null}
                <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
            <View style={styles.viewfinder}>
              <View style={styles.frame}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </View>
              <Text style={styles.hint}>Snap an item, then name it</Text>
            </View>
            <View style={styles.captureBottom}>
              <Pressable onPress={captureSingle} style={styles.shutter} accessibilityLabel="Capture">
                <Icon name="camera" size={30} color="#fff" />
              </Pressable>
            </View>
          </>
        ) : null}

        {view === 'stream' ? (
          <>
            {/* back to single capture · photos switch */}
            <View style={styles.streamSwitchRow}>
              <Pressable
                onPress={() => mic !== 'listening' && setView('capture')}
                style={styles.backPill}
                accessibilityLabel="Single item"
              >
                <Icon name="chevron-left" size={15} color="#fff" />
                <Text style={styles.backPillText}>Single item</Text>
              </Pressable>
              <Pressable
                onPress={() => mic !== 'listening' && setVoiceMode((v) => !v)}
                style={styles.switchBtn}
              >
                <Icon
                  name={voiceMode ? 'camera-off' : 'camera'}
                  size={17}
                  color={voiceMode ? 'rgba(255,255,255,0.55)' : '#fff'}
                />
                <Text style={styles.switchLabel}>{voiceMode ? 'Photos off' : 'Photos on'}</Text>
                <View
                  style={[
                    styles.track,
                    { backgroundColor: voiceMode ? 'rgba(255,255,255,0.25)' : colors.brand },
                  ]}
                >
                  <View style={[styles.knob, { left: voiceMode ? 3 : 19 }]} />
                </View>
              </Pressable>
            </View>

            {/* viewfinder */}
            <View style={styles.viewfinder}>
              {photoMode ? (
                <View style={styles.frame}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                </View>
              ) : (
                <View style={styles.voiceRing}>
                  <View style={styles.voiceRingInner} />
                  <Icon name="list-music" size={52} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              <Text style={styles.hint}>
                {mic === 'listening'
                  ? 'Listening… tap the button when you’re done'
                  : voiceMode
                    ? 'Tap, then name everything in the box'
                    : 'Snap, then say what it is'}
              </Text>
              {simulated ? (
                <Text style={styles.simNote}>Mic unavailable here — simulating dictation</Text>
              ) : null}
            </View>

            {/* mic pills */}
            <View style={styles.pillRow}>
              {mic === 'listening' ? (
                <View style={styles.pillListening}>
                  <View style={styles.wave}>
                    {[14, 9, 15, 11].map((h, i) => (
                      <View key={i} style={[styles.waveBar, { height: h }]} />
                    ))}
                  </View>
                  <Text style={styles.pillListenText} numberOfLines={1}>
                    {'“' + (transcript || '…') + '”'}
                  </Text>
                </View>
              ) : null}
              {mic === 'gotit' && (lastBatch > 1 || (lastIt && !lastIt.needsFix)) ? (
                <View style={styles.pillGot}>
                  <Icon name="check" size={16} color={palette.green700} />
                  <Text style={styles.pillGotText}>
                    {lastBatch > 1 ? `Added ${lastBatch} items` : `Got it — ${lastIt?.name}`}
                  </Text>
                </View>
              ) : null}
              {mic === 'fail' ? (
                <Pressable onPress={() => lastId && setEditId(lastId)} style={styles.pillFail}>
                  <Icon name="ear" size={16} color={palette.amber600} />
                  <Text style={styles.pillFailText}>Hmm — didn't catch a name. Tap to type it.</Text>
                </Pressable>
              ) : null}
            </View>

            {/* last captured card */}
            {lastIt && !flash ? (
              <Pressable onPress={() => setEditId(lastIt.id)} style={styles.lastCard}>
                <View style={[styles.lastIcon, { backgroundColor: boxTint(colorOf(lastIt.boxId)) }]}>
                  <Icon name={lastIt.icon} size={22} color={boxColor(colorOf(lastIt.boxId))} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[styles.lastName, lastIt.needsFix && { color: palette.amber600 }]}
                  >
                    {lastIt.name}
                  </Text>
                  <View style={styles.chipRow}>
                    {lastIt.qty && lastIt.qty > 1 ? <Text style={styles.qtyChip}>×{lastIt.qty}</Text> : null}
                    {lastIt.value != null ? <Text style={styles.valChip}>{money(lastIt.value)}</Text> : null}
                    <Text style={styles.fixHint}>Tap to fix</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={styles.addedRow}>
                    <Icon name="check" size={14} color={palette.green700} />
                    <Text style={styles.addedText}>Added</Text>
                  </View>
                  <Pressable onPress={onUndo}>
                    <Text style={styles.undo}>Undo</Text>
                  </Pressable>
                </View>
              </Pressable>
            ) : null}

            {/* bottom controls */}
            <View style={styles.bottom}>
              <View style={styles.bottomSide}>
                <Pressable
                  onPress={() => setLedgerOpen(true)}
                  style={styles.strip}
                  accessibilityLabel="Session items"
                >
                  {session.slice(-2).map((it, i) => (
                    <View
                      key={it.id}
                      style={[
                        styles.thumb,
                        { backgroundColor: boxTint(colorOf(it.boxId)), marginLeft: i === 0 ? 0 : -16 },
                      ]}
                    >
                      <Icon name={it.icon} size={20} color={boxColor(colorOf(it.boxId))} />
                    </View>
                  ))}
                  <Text style={[styles.countPill, session.length ? { marginLeft: 18 } : null]}>
                    {session.length}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={onCapture}
                style={[styles.shutter, mic === 'listening' && styles.shutterStop]}
                accessibilityLabel={mic === 'listening' ? 'Stop' : voiceMode ? 'Say items' : 'Capture'}
              >
                <Icon
                  name={mic === 'listening' ? 'square' : voiceMode ? 'mic' : 'camera'}
                  size={mic === 'listening' ? 26 : voiceMode ? 32 : 30}
                  color="#fff"
                />
              </Pressable>
              <View style={[styles.bottomSide, { alignItems: 'flex-end' }]}>
                <Pressable onPress={onResay} style={styles.redo} accessibilityLabel="Redo last">
                  <Icon name="rotate-ccw" size={20} color={resayActive ? '#fff' : 'rgba(255,255,255,0.4)'} />
                </Pressable>
              </View>
            </View>
          </>
        ) : null}
      </SafeAreaView>

      {flash ? <View style={styles.flashOverlay} /> : null}

      {/* box picker */}
      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={view === 'capture' ? 'Capture into which box?' : 'Stream into which box?'}
      >
        <View style={{ gap: 6 }}>
          {boxes.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => {
                setBoxId(b.id);
                setPickerOpen(false);
              }}
              style={[styles.pickRow, b.id === boxId && { backgroundColor: palette.green50 }]}
            >
              <View style={[styles.pickRail, { backgroundColor: boxColor(b.color) }]} />
              <Text style={styles.pickLabel}>
                #{b.number} {b.name}
              </Text>
              {b.id === boxId ? <Icon name="check" size={18} color={colors.success} /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* session ledger */}
      <Sheet visible={ledgerOpen} onClose={() => setLedgerOpen(false)} title="This session">
        <Text style={styles.ledgerTotals}>
          {session.length} {session.length === 1 ? 'item' : 'items'} · {money(sessionValue)}
          {fixCount ? ` · ${fixCount} to fix` : ''}
        </Text>
        <ScrollView style={{ maxHeight: 320 }}>
          {session.length === 0 ? (
            <Text style={styles.empty}>Nothing yet — snap your first item.</Text>
          ) : null}
          {[...session].reverse().map((it) => (
            <Pressable
              key={it.id}
              onPress={() => setEditId(it.id)}
              style={[styles.ledgerRow, it.needsFix && { backgroundColor: palette.amber50 }]}
            >
              <View style={[styles.lastIcon, { backgroundColor: boxTint(colorOf(it.boxId)) }]}>
                <Icon name={it.icon} size={19} color={boxColor(colorOf(it.boxId))} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.ledgerName, it.needsFix && { color: palette.amber600 }]}
                >
                  {it.name}
                </Text>
                {it.needsFix ? (
                  <Text style={styles.ledgerFix}>That doesn't look right — tap to fix</Text>
                ) : null}
              </View>
              {it.qty && it.qty > 1 ? <Text style={styles.qtyChip}>×{it.qty}</Text> : null}
              {it.value != null ? <Text style={styles.valChip}>{money(it.value)}</Text> : null}
              <Icon name="pencil" size={16} color={palette.ink400} />
            </Pressable>
          ))}
        </ScrollView>
        <Button fullWidth onPress={() => setLedgerOpen(false)} style={{ marginTop: 12 }}>
          Back to camera
        </Button>
      </Sheet>

      {/* edit item */}
      <Sheet visible={!!editIt} onClose={() => setEditId(null)} title="Fix this item">
        {editIt ? (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Item name</Text>
              <TextInput
                value={editIt.name === 'Untitled item' && editIt.needsFix ? '' : editIt.name}
                onChangeText={(v) => patchEdit({ name: v, icon: iconFor(v), needsFix: false })}
                placeholder="e.g. Cast iron skillet"
                placeholderTextColor={palette.ink400}
                style={styles.input}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.fieldLabel}>Value</Text>
                <View style={styles.valInputWrap}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput
                    value={editIt.value != null ? String(editIt.value) : ''}
                    onChangeText={(v) => {
                      const c = v.replace(/[^0-9.]/g, '');
                      patchEdit({ value: c === '' ? null : parseFloat(c) });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={palette.ink400}
                    style={styles.valInput}
                  />
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <Text style={styles.fieldLabel}>Quantity</Text>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => patchEdit({ qty: Math.max(1, (editIt.qty || 1) - 1) })}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepTxt}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyVal}>{editIt.qty || 1}</Text>
                  <Pressable onPress={() => patchEdit({ qty: (editIt.qty || 1) + 1 })} style={styles.stepBtn}>
                    <Text style={styles.stepTxt}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Button
                variant="danger"
                iconLeft="trash-2"
                onPress={() => {
                  setSession((prev) => prev.filter((it) => it.id !== editId));
                  if (lastId === editId) setLastId(null);
                  setEditId(null);
                }}
              >
                Remove
              </Button>
              <View style={{ flex: 1 }}>
                <Button
                  fullWidth
                  onPress={() => {
                    patchEdit({ name: editIt.name.trim() || 'Untitled item', needsFix: !editIt.name.trim() });
                    setEditId(null);
                  }}
                >
                  Done
                </Button>
              </View>
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* session summary */}
      {summaryOpen ? (
        <View style={styles.summaryScrim}>
          <View style={styles.summaryCard}>
            <SlothGlyph />
            <Text style={styles.summaryTitle}>Nice streak!</Text>
            <Text style={styles.summaryLabel}>{summaryLabel}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, width: '100%' }}>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" fullWidth onPress={() => setSummaryOpen(false)}>
                  Keep going
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button fullWidth onPress={finish}>
                  Done
                </Button>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {/* Pro upsell for the capture-view "Switch to Stream" pill (free users) */}
      <StreamUpsell
        visible={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        onTryPro={() => {
          setUpsellOpen(false);
          // Pro is account-tied — a guest must sign in before starting the trial.
          if (!signedIn) {
            router.push('/sign-in');
            return;
          }
          startProTrial();
          setView('stream');
        }}
      />
    </View>
  );
}

function SlothGlyph() {
  // The sloth-in-a-box mark (same art as the app icon).
  return (
    <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="package-check" size={68} color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#161817' },
  camScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,22,21,0.32)',
  },
  safe: { flex: 1 },
  shutterStop: { backgroundColor: palette.red500, borderColor: 'rgba(255,255,255,0.85)' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    maxWidth: 220,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  boxChipText: { color: '#fff', fontFamily: fonts.body.bold, fontSize: 13.5, flexShrink: 1 },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingLeft: 15,
    paddingRight: 10,
  },
  switchLabel: { color: '#fff', fontFamily: fonts.body.extra, fontSize: 13 },
  track: { width: 40, height: 24, borderRadius: 999, justifyContent: 'center' },
  knob: { position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  iconBtnOn: { backgroundColor: palette.amber400 },
  // capture view
  captureSwitchWrap: { marginTop: 12, paddingHorizontal: 16 },
  streamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  streamPillText: { color: '#fff', fontFamily: fonts.body.extra, fontSize: 14.5 },
  proBadge: {
    backgroundColor: palette.amber400,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  proBadgeText: { fontSize: 10, fontFamily: fonts.body.extra, color: palette.ink900, letterSpacing: 0.3 },
  captureBottom: { position: 'absolute', left: 0, right: 0, bottom: 36, alignItems: 'center' },
  // stream view switch-back row
  streamSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 38,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  backPillText: { color: '#fff', fontFamily: fonts.body.extra, fontSize: 13 },
  viewfinder: { alignItems: 'center', marginTop: 28, gap: 14, paddingHorizontal: 40 },
  frame: { width: 160, height: 160 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: 'rgba(255,255,255,0.85)' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  voiceRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceRingInner: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hint: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body.bold, fontSize: 13, textAlign: 'center' },
  simNote: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fonts.body.bold,
    fontSize: 11.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  pillRow: {
    alignItems: 'center',
    marginTop: 26,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pillListening: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    maxWidth: '100%',
  },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 16 },
  waveBar: { width: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.95)' },
  pillListenText: { color: '#fff', fontFamily: fonts.body.bold, fontSize: 14, flexShrink: 1 },
  pillGot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.green50,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  pillGotText: { color: palette.green700, fontFamily: fonts.body.extra, fontSize: 14 },
  pillFail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.amber50,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  pillFailText: { color: palette.amber600, fontFamily: fonts.body.extra, fontSize: 13 },
  lastCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 150,
    backgroundColor: colors.surfaceCard,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  lastIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  lastName: { fontFamily: fonts.body.extra, fontSize: 14.5, color: palette.ink900 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' },
  qtyChip: {
    backgroundColor: palette.cream200,
    color: palette.ink700,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 9,
    fontSize: 11.5,
    fontFamily: fonts.body.extra,
    overflow: 'hidden',
  },
  valChip: {
    backgroundColor: palette.amber50,
    color: palette.amber600,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 9,
    fontSize: 11.5,
    fontFamily: fonts.body.extra,
    overflow: 'hidden',
  },
  fixHint: { color: palette.ink400, fontSize: 11.5, fontFamily: fonts.body.bold },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addedText: { color: palette.green700, fontSize: 12, fontFamily: fonts.body.extra },
  undo: {
    color: palette.ink400,
    fontFamily: fonts.body.extra,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  bottomSide: { flex: 1 },
  strip: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    color: '#fff',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 12,
    fontFamily: fonts.body.extra,
    overflow: 'hidden',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashOverlay: { position: 'absolute', inset: 0, backgroundColor: '#fff', opacity: 0.85 },
  // sheets
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.cream100,
    minHeight: 48,
  },
  pickRail: { width: 14, height: 32, borderRadius: 7 },
  pickLabel: { flex: 1, fontFamily: fonts.body.extra, fontSize: 14.5, color: palette.ink900 },
  ledgerTotals: { fontFamily: fonts.body.extra, fontSize: 12.5, color: palette.ink400, marginBottom: 8 },
  empty: {
    paddingVertical: 24,
    textAlign: 'center',
    color: palette.ink400,
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 8,
    borderRadius: 12,
    marginBottom: 2,
  },
  ledgerName: { fontFamily: fonts.body.extra, fontSize: 14, color: palette.ink900 },
  ledgerFix: { fontSize: 11.5, fontFamily: fonts.body.bold, color: palette.amber600 },
  fieldLabel: { fontSize: 13, fontFamily: fonts.body.bold, color: palette.ink700 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.body.bold,
    fontSize: 16,
    color: palette.ink900,
  },
  valInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  dollar: { color: palette.ink400, fontFamily: fonts.body.extra },
  valInput: { flex: 1, fontFamily: fonts.body.bold, fontSize: 16, color: palette.ink900 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 48,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: 14,
    paddingHorizontal: 6,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.cream200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { fontSize: 18, fontFamily: fonts.body.extra, color: palette.ink700 },
  qtyVal: {
    minWidth: 32,
    textAlign: 'center',
    fontFamily: fonts.body.extra,
    fontSize: 16,
    color: palette.ink900,
  },
  summaryScrim: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(42,39,34,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  summaryCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  summaryTitle: { fontFamily: fonts.display.bold, fontSize: 22, color: palette.ink900 },
  summaryLabel: {
    fontSize: 14,
    fontFamily: fonts.body.bold,
    color: palette.ink500,
    textAlign: 'center',
    lineHeight: 20,
  },
});
