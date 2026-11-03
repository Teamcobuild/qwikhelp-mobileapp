import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
    type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import {
    LOGO_BLUE,
    LOGO_INK,
    LOGO_LETTER_PATHS,
    LOGO_MARK_PATH,
    LOGO_MARK_WIDTH,
    LOGO_VIEWBOX,
} from "../constants/logoPaths";

const LOGO_WIDTH = 260;
const LOGO_HEIGHT = (LOGO_WIDTH * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width;
const MARK_WIDTH = (LOGO_WIDTH * LOGO_MARK_WIDTH) / LOGO_VIEWBOX.width;
// Distance that puts the mark alone in the centre before the wordmark slides in.
const MARK_CENTER_OFFSET = LOGO_WIDTH / 2 - MARK_WIDTH / 2;

const MARK_IN = 550;
const SLIDE = 550;
const LETTER_STAGGER = 55;
const LETTER_DURATION = 320;
const WORDMARK_DURATION = LETTER_STAGGER * (LOGO_LETTER_PATHS.length - 1) + LETTER_DURATION;
const HOLD = 350;
const FADE_OUT = 300;

// Plays the full-screen logo animation once, then calls onFinish so the caller can unmount it.
export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
    const reduceMotion = useReducedMotion();

    const markScale = useSharedValue(reduceMotion ? 1 : 0);
    const markRotate = useSharedValue(reduceMotion ? 0 : -25);
    const markShift = useSharedValue(reduceMotion ? 0 : MARK_CENTER_OFFSET);
    // Elapsed ms of the wordmark reveal; each letter derives its own staggered progress from it.
    const wordmarkTime = useSharedValue(reduceMotion ? WORDMARK_DURATION : 0);
    const screenOpacity = useSharedValue(1);
    const screenScale = useSharedValue(1);

    useEffect(() => {
        const finish = () => {
            screenOpacity.value = withTiming(0, { duration: FADE_OUT }, (done) => {
                if (done) runOnJS(onFinish)();
            });
            screenScale.value = withTiming(1.06, { duration: FADE_OUT });
        };

        if (reduceMotion) {
            const t = setTimeout(finish, 600);
            return () => clearTimeout(t);
        }

        markScale.value = withSequence(
            withSpring(1.12, { damping: 9, stiffness: 160 }),
            withSpring(1, { damping: 12, stiffness: 180 })
        );
        markRotate.value = withSpring(0, { damping: 10, stiffness: 120 });
        markShift.value = withDelay(
            MARK_IN,
            withTiming(0, { duration: SLIDE, easing: Easing.out(Easing.cubic) })
        );
        wordmarkTime.value = withDelay(
            MARK_IN + 120,
            withTiming(WORDMARK_DURATION, { duration: WORDMARK_DURATION, easing: Easing.linear })
        );

        const total = MARK_IN + 120 + WORDMARK_DURATION + HOLD;
        const t = setTimeout(finish, total);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const screenStyle = useAnimatedStyle(() => ({
        opacity: screenOpacity.value,
        transform: [{ scale: screenScale.value }],
    }));

    const markStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: markShift.value },
            { scale: markScale.value },
            { rotate: `${markRotate.value}deg` },
        ],
    }));

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.screen, screenStyle]} pointerEvents="none">
            <View style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}>
                {LOGO_LETTER_PATHS.map((d, i) => (
                    <Letter key={i} d={d} index={i} time={wordmarkTime} />
                ))}
                <Animated.View style={[styles.mark, markStyle]}>
                    <Svg
                        width={MARK_WIDTH}
                        height={LOGO_HEIGHT}
                        viewBox={`0 0 ${LOGO_MARK_WIDTH} ${LOGO_VIEWBOX.height}`}
                    >
                        <Path d={LOGO_MARK_PATH} fill={LOGO_BLUE} />
                    </Svg>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

function Letter({ d, index, time }: { d: string; index: number; time: SharedValue<number> }) {
    const style = useAnimatedStyle(() => {
        const linear = Math.min(Math.max((time.value - index * LETTER_STAGGER) / LETTER_DURATION, 0), 1);
        const progress = 1 - Math.pow(1 - linear, 3);
        return {
            opacity: progress,
            transform: [{ translateY: (1 - progress) * 14 }],
        };
    });

    return (
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
            <Svg
                width={LOGO_WIDTH}
                height={LOGO_HEIGHT}
                viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
            >
                <Path d={d} fill={LOGO_INK} />
            </Svg>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        elevation: 1000,
    },
    mark: {
        position: "absolute",
        left: 0,
        top: 0,
    },
});
