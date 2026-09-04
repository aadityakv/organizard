// The capture screen (Claude Design "Streaming Mode Prototype"). Two views of ONE
// screen, flipped in place (no extra navigation — one X closes everything):
//   • capture (free): snap one item → name it in Add-item, one at a time. A
//     "Switch to Stream" pill flips to stream (Pro; free users see the upsell).
//   • stream (Pro): rapid session — Photos-on (snap → say one item) or Photos-off
//     (talk a whole box in at once) → ledger (tap to fix) → Done commits via addItem.
// Dictation is simulated for now (lib/dictation); the on-device mic swaps in later.
// The pieces live in features/stream; this file is the layout + orchestration.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView } from 'expo-camera';

import { Button, Icon, StreamUpsell } from '@/components';
import {
  BoxPickerSheet,
  CaptureView,
  EditItemSheet,
  LastCapturedCard,
  LedgerSheet,
  MicPills,
  ModeSwitchRow,
  StreamBottomBar,
  TopBar,
  Viewfinder,
  useDictation,
  useSnapCapture,
  useStreamSession,
  type StreamView,
} from '@/features/stream';
import { money } from '@/lib/money';
import { iconFor } from '@/lib/streamParse';
import { uid } from '@/lib/uid';
import { isProNow, useStore } from '@/store/useStore';
import { colors, fonts, palette } from '@/theme';

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
  const [view, setView] = useState<StreamView>(() =>
    initialView !== 'capture' && isProNow(useStore.getState()) ? 'stream' : 'capture',
  );
  const [voiceMode, setVoiceMode] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [torch, setTorch] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const session = useStreamSession();
  // Destructured so render only touches plain values (the linter rightly objects to
  // reaching through an object that also carries the camera ref).
  const { cameraRef, cameraGranted, flash, snapForNextItem, snapOnce, takePendingPhoto, invalidatePending } =
    useSnapCapture();
  // The mic parses what was heard and hands the result to the ledger; these handlers
  // close over the current box / pending photo and are re-read when a capture finishes.
  const dictation = useDictation({
    onUtterance: (p, target) => {
      if (target) {
        // Re-saying an item fills in only what was heard this time.
        session.patch(target, (it) => ({
          name: p.name || it.name,
          qty: p.qty ?? it.qty,
          value: p.value ?? it.value,
          icon: iconFor(p.name || it.name),
          needsFix: !p.name && it.needsFix,
        }));
        session.setLastId(target);
      } else {
        session.addOne({
          id: uid('s'),
          name: p.name || 'Untitled item',
          qty: p.qty,
          value: p.value,
          icon: iconFor(p.name),
          needsFix: !p.name,
          boxId,
          photo: takePendingPhoto(),
        });
      }
    },
    onList: (parsed) => {
      session.addBatch(
        parsed.map((p) => ({
          id: uid('v'),
          name: p.name,
          qty: p.qty,
          value: p.value,
          icon: iconFor(p.name),
          needsFix: false,
          boxId,
        })),
      );
    },
  });

  // Switching mode or view invalidates any in-flight / pending photo, so a slow stream
  // capture can't attach to a later item after a flip.
  useEffect(() => {
    invalidatePending();
  }, [voiceMode, view, invalidatePending]);

  const photoMode = !voiceMode;
  // Camera is live in capture view, and in stream view only with Photos on.
  const cameraOn = cameraGranted && (view === 'capture' || photoMode);
  const box = boxes.find((b) => b.id === boxId) ?? boxes[0];
  const lastIt = session.lastIt;
  const colorOf = (id: string) => boxes.find((b) => b.id === id)?.color ?? box?.color ?? 'green';
  const resayActive = voiceMode ? session.lastBatchIds.length > 0 : !!session.lastId;
  const summaryLabel = `${session.session.length} ${session.session.length === 1 ? 'item' : 'items'} tucked into ${session.boxCount} ${session.boxCount === 1 ? 'box' : 'boxes'} — ${money(session.sessionValue)} packed.`;

  // The big button: tap to capture, tap again to stop (finish the utterance now).
  const onCapture = () => {
    if (dictation.mic === 'listening') {
      dictation.stop();
      return;
    }
    if (voiceMode) {
      dictation.beginListen(null, true);
    } else {
      snapForNextItem();
      setTimeout(() => dictation.beginListen(null, false), 230);
    }
  };

  // Capture view (free single item): snap → name it in Add-item, one at a time.
  const captureSingle = async () => {
    if (!boxId) return;
    // No camera yet — open the form; it has its own photo + permission UI.
    if (!cameraGranted) {
      router.push({ pathname: '/add-item', params: { boxId } });
      return;
    }
    const photo = await snapOnce();
    router.push({ pathname: '/add-item', params: photo ? { boxId, photo } : { boxId } });
  };

  // Switch to Stream in place (no navigation). Free users get the upsell first.
  const onSwitchToStream = () => {
    if (isPro) setView('stream');
    else setUpsellOpen(true);
  };

  const onResay = () => {
    if (dictation.mic === 'listening') return;
    if (voiceMode) {
      if (!session.retractLastBatch()) return;
      dictation.beginListen(null, true);
    } else if (session.lastId) {
      dictation.beginListen(session.lastId, false);
    }
  };

  const onUndo = () => {
    session.undo();
    dictation.setMic('ready');
  };

  const closeStream = () => {
    // Stop a live mic first, so a late onFinal can't append a phantom item after the
    // summary's count is computed (and committed by finish()).
    if (dictation.mic === 'listening') dictation.cancel();
    if (session.session.length > 0) setSummaryOpen(true);
    else router.back();
  };

  const finish = () => {
    session.commit();
    setSummaryOpen(false);
    router.replace({
      pathname: `/box/${initialBoxId ?? boxId}`,
      params: { streamed: String(session.session.length) },
    });
  };

  return (
    <View style={styles.root}>
      {/* Live camera behind capture / photo-mode UI; dark backdrop otherwise. */}
      {cameraOn ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      ) : null}
      {cameraOn ? <View style={styles.camScrim} /> : null}
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar
          box={box}
          cameraOn={cameraOn}
          torch={torch}
          onClose={closeStream}
          onPickBox={() => setPickerOpen(true)}
          onToggleTorch={() => setTorch((t) => !t)}
        />

        {view === 'capture' ? (
          <CaptureView isPro={isPro} onSwitchToStream={onSwitchToStream} onCapture={captureSingle} />
        ) : (
          <>
            <ModeSwitchRow
              voiceMode={voiceMode}
              listening={dictation.mic === 'listening'}
              onBackToCapture={() => setView('capture')}
              onToggleVoiceMode={() => setVoiceMode((v) => !v)}
            />

            <Viewfinder
              mode={photoMode ? 'frame' : 'voice'}
              hint={
                dictation.mic === 'listening'
                  ? 'Listening… tap the button when you’re done'
                  : voiceMode
                    ? 'Tap, then name everything in the box'
                    : 'Snap, then say what it is'
              }
              note={dictation.simulated ? 'Mic unavailable here — simulating dictation' : null}
            />

            <MicPills
              mic={dictation.mic}
              transcript={dictation.transcript}
              lastBatch={dictation.lastBatch}
              lastIt={session.lastIt}
              onFixLast={() => session.lastId && session.setEditId(session.lastId)}
            />

            {lastIt && !flash ? (
              <LastCapturedCard
                item={lastIt}
                colorOf={colorOf}
                onEdit={() => session.setEditId(lastIt.id)}
                onUndo={onUndo}
              />
            ) : null}

            <StreamBottomBar
              session={session.session}
              mic={dictation.mic}
              voiceMode={voiceMode}
              resayActive={resayActive}
              colorOf={colorOf}
              onOpenLedger={() => setLedgerOpen(true)}
              onCapture={onCapture}
              onResay={onResay}
            />
          </>
        )}
      </SafeAreaView>

      {flash ? <View style={styles.flashOverlay} /> : null}

      <BoxPickerSheet
        visible={pickerOpen}
        view={view}
        boxes={boxes}
        selectedId={boxId}
        onSelect={(id) => {
          setBoxId(id);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />

      <LedgerSheet
        visible={ledgerOpen}
        session={session.session}
        sessionValue={session.sessionValue}
        fixCount={session.fixCount}
        colorOf={colorOf}
        onEdit={(id) => session.setEditId(id)}
        onClose={() => setLedgerOpen(false)}
      />

      <EditItemSheet
        item={session.editIt}
        onPatch={(patch) => {
          if (session.editId) session.patch(session.editId, patch);
        }}
        onRemove={() => {
          if (session.editId) session.remove(session.editId);
          session.setEditId(null);
        }}
        onClose={() => session.setEditId(null)}
      />

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
  flashOverlay: { position: 'absolute', inset: 0, backgroundColor: '#fff', opacity: 0.85 },
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
