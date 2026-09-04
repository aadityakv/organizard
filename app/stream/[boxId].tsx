// Capture screen: one route with two views that flip in place, so a single X
// always closes everything.
//   capture (free): snap one item, then name it in the add-item form.
//   stream (Pro): a rapid session. With photos on, each snap is followed by saying
//     the item; with photos off, a whole box is spoken in at once. Everything lands
//     in a ledger (tap to fix) and Done commits the session through addItem.
// Free users start in capture and reach stream only through the gated upsell.
// The pieces live in features/stream; this file is the layout and orchestration.
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
import { iconFor } from '@/lib/voice/streamParse';
import { uid, ID_PREFIX } from '@/lib/uid';
import { isProNow, useStore } from '@/store/useStore';
import { colors, fonts, palette, DEFAULT_HUE, alpha } from '@/theme';
import { MIC, STREAM_VIEW } from '@/features/stream/types';
import { routes } from '@/lib/routes';
import { countOf } from '@/lib/text';
import { copy } from '@/copy/stream';

/** Capture screen: free single-item capture and the Pro streaming session, flipped in place. */
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
    initialView !== STREAM_VIEW.capture && isProNow(useStore.getState())
      ? STREAM_VIEW.stream
      : STREAM_VIEW.capture,
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
          id: uid(ID_PREFIX.streamItem),
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
          id: uid(ID_PREFIX.voiceItem),
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
  const cameraOn = cameraGranted && (view === STREAM_VIEW.capture || photoMode);
  const box = boxes.find((b) => b.id === boxId) ?? boxes[0];
  const lastIt = session.lastIt;
  const colorOf = (id: string) => boxes.find((b) => b.id === id)?.color ?? box?.color ?? DEFAULT_HUE;
  const resayActive = voiceMode ? session.lastBatchIds.length > 0 : !!session.lastId;
  const summaryLabel = `${countOf(session.session.length, 'item')} tucked into ${session.boxCount} ${session.boxCount === 1 ? 'box' : 'boxes'} — ${money(session.sessionValue)} packed.`;

  const onCapture = () => {
    if (dictation.mic === MIC.listening) {
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

  const captureSingle = async () => {
    if (!boxId) return;
    // No camera yet — open the form; it has its own photo + permission UI.
    if (!cameraGranted) {
      router.push({ pathname: routes.addItem, params: { boxId } });
      return;
    }
    const photo = await snapOnce();
    router.push({ pathname: routes.addItem, params: photo ? { boxId, photo } : { boxId } });
  };

  const onSwitchToStream = () => {
    if (isPro) setView(STREAM_VIEW.stream);
    else setUpsellOpen(true);
  };

  const onResay = () => {
    if (dictation.mic === MIC.listening) return;
    if (voiceMode) {
      if (!session.retractLastBatch()) return;
      dictation.beginListen(null, true);
    } else if (session.lastId) {
      dictation.beginListen(session.lastId, false);
    }
  };

  const onUndo = () => {
    session.undo();
    dictation.setMic(MIC.ready);
  };

  const closeStream = () => {
    // Stop a live mic first, so a late onFinal can't append a phantom item after the
    // summary's count is computed (and committed by finish()).
    if (dictation.mic === MIC.listening) dictation.cancel();
    if (session.session.length > 0) setSummaryOpen(true);
    else router.back();
  };

  const finish = () => {
    session.commit();
    setSummaryOpen(false);
    router.replace({
      pathname: routes.box(initialBoxId ?? boxId),
      params: { streamed: String(session.session.length) },
    });
  };

  return (
    <View style={styles.root}>
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

        {view === STREAM_VIEW.capture ? (
          <CaptureView isPro={isPro} onSwitchToStream={onSwitchToStream} onCapture={captureSingle} />
        ) : (
          <>
            <ModeSwitchRow
              voiceMode={voiceMode}
              listening={dictation.mic === MIC.listening}
              onBackToCapture={() => setView(STREAM_VIEW.capture)}
              onToggleVoiceMode={() => setVoiceMode((v) => !v)}
            />

            <Viewfinder
              mode={photoMode ? 'frame' : 'voice'}
              hint={
                dictation.mic === MIC.listening
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
            <Text style={styles.summaryTitle}>{copy.streakTitle}</Text>
            <Text style={styles.summaryLabel}>{summaryLabel}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, width: '100%' }}>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" fullWidth onPress={() => setSummaryOpen(false)}>
                  {copy.keepGoingButton}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button fullWidth onPress={finish}>
                  {copy.doneButton}
                </Button>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <StreamUpsell
        visible={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        onTryPro={() => {
          setUpsellOpen(false);
          // Pro is account-tied — a guest must sign in before starting the trial.
          if (!signedIn) {
            router.push(routes.signIn);
            return;
          }
          startProTrial();
          setView(STREAM_VIEW.stream);
        }}
      />
    </View>
  );
}

function SlothGlyph() {
  return (
    <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="package-check" size={68} color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cameraBg },
  camScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(palette.cameraInk, 0.32),
  },
  safe: { flex: 1 },
  flashOverlay: { position: 'absolute', inset: 0, backgroundColor: palette.white, opacity: 0.85 },
  summaryScrim: {
    position: 'absolute',
    inset: 0,
    backgroundColor: alpha(palette.ink900, 0.55),
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
