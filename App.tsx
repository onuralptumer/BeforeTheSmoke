/**
 * Before the Smoke.
 *
 * Two screens and a progress map — no navigation library, because two screens
 * do not need one.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {LevelDefinition} from './src/game/types';
import {LEVELS} from './src/game/levels';
import {RecordedRun} from './src/game/replay/record';
import {GameScreen} from './src/screens/GameScreen';
import {LevelSelectScreen} from './src/screens/LevelSelectScreen';
import {
  ProgressMap,
  initialProgress,
  loadProgress,
  recordResult,
} from './src/storage/progress';
import {palette} from './src/theme';

function App() {
  const [progress, setProgress] = useState<ProgressMap>(initialProgress);
  const [level, setLevel] = useState<LevelDefinition | null>(null);

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  // Read through a ref so a result landing while a previous write is still in
  // flight folds into the newest map rather than an captured stale one.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const handleResult = useCallback((run: RecordedRun) => {
    recordResult(progressRef.current, run.result, run.signal).then(setProgress);
  }, []);

  const currentIndex = level ? LEVELS.findIndex(l => l.id === level.id) : -1;
  const following = currentIndex >= 0 ? LEVELS[currentIndex + 1] : undefined;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <View style={styles.root}>
          {level ? (
            <GameScreen
              key={level.id}
              level={level}
              onExit={() => setLevel(null)}
              onNext={following ? () => setLevel(following) : null}
              onResult={handleResult}
            />
          ) : (
            <LevelSelectScreen progress={progress} onSelect={setLevel} />
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.background},
});

export default App;
