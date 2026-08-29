import { useTheme } from 'react-native-paper';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const SIZE = 200;

export type IllustrationName = 'private' | 'models' | 'images' | 'start';

const Private = () => {
  const { colors } = useTheme();
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 200 200">
      <Rect
        x="58"
        y="24"
        width="84"
        height="152"
        rx="16"
        fill={colors.surfaceVariant}
        stroke={colors.outlineVariant}
        strokeWidth="2"
      />
      <Rect x="86" y="34" width="28" height="4" rx="2" fill={colors.outline} />
      <Rect
        x="82"
        y="92"
        width="36"
        height="30"
        rx="6"
        fill={colors.primary}
        opacity={0.9}
      />
      <Path
        d="M88 92v-10a12 12 0 0 1 24 0v10"
        stroke={colors.primary}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx="100" cy="105" r="4" fill={colors.onPrimary} />
      <Circle cx="42" cy="60" r="5" fill={colors.tertiary} opacity={0.5} />
      <Circle cx="160" cy="132" r="7" fill={colors.secondary} opacity={0.4} />
    </Svg>
  );
};

const Models = () => {
  const { colors } = useTheme();
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 200 200">
      <Rect
        x="34"
        y="124"
        width="132"
        height="36"
        rx="12"
        fill={colors.surfaceVariant}
        stroke={colors.outlineVariant}
        strokeWidth="2"
      />
      <Rect
        x="46"
        y="80"
        width="108"
        height="36"
        rx="12"
        fill={colors.surfaceVariant}
        stroke={colors.outlineVariant}
        strokeWidth="2"
      />
      <Rect
        x="58"
        y="36"
        width="84"
        height="36"
        rx="12"
        fill={colors.primary}
        opacity={0.92}
      />
      <Circle cx="76" cy="54" r="6" fill={colors.onPrimary} />
      <Rect
        x="90"
        y="50"
        width="38"
        height="6"
        rx="3"
        fill={colors.onPrimary}
        opacity={0.85}
      />
      <Circle cx="64" cy="98" r="6" fill={colors.outline} />
      <Rect
        x="78"
        y="95"
        width="52"
        height="6"
        rx="3"
        fill={colors.outline}
        opacity={0.6}
      />
      <Circle cx="52" cy="142" r="6" fill={colors.outline} />
      <Rect
        x="66"
        y="139"
        width="70"
        height="6"
        rx="3"
        fill={colors.outline}
        opacity={0.6}
      />
    </Svg>
  );
};

const Images = () => {
  const { colors } = useTheme();
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 200 200">
      <Rect
        x="36"
        y="46"
        width="128"
        height="98"
        rx="14"
        fill={colors.surfaceVariant}
        stroke={colors.outlineVariant}
        strokeWidth="2"
      />
      <Circle cx="72" cy="78" r="11" fill={colors.tertiary} opacity={0.85} />
      <Path
        d="M44 132l34-34 24 22 20-18 34 32v6a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6z"
        fill={colors.primary}
        opacity={0.85}
      />
      <Path
        d="M150 40l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"
        fill={colors.secondary}
      />
      <Path
        d="M44 152l2.5 7.5L54 162l-7.5 2.5L44 172l-2.5-7.5L34 162l7.5-2.5z"
        fill={colors.tertiary}
        opacity={0.7}
      />
    </Svg>
  );
};

const Start = () => {
  const { colors } = useTheme();
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="66" fill={colors.primary} opacity={0.1} />
      <Circle cx="100" cy="100" r="46" fill={colors.primary} opacity={0.16} />
      <Path
        d="M56 74a14 14 0 0 1 14-14h60a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14H92l-22 18v-18h-0a14 14 0 0 1-14-14z"
        fill={colors.primary}
      />
      <Circle cx="82" cy="94" r="6" fill={colors.onPrimary} />
      <Circle cx="100" cy="94" r="6" fill={colors.onPrimary} />
      <Circle cx="118" cy="94" r="6" fill={colors.onPrimary} />
      <Path
        d="M152 44l3.5 10.5L166 58l-10.5 3.5L152 72l-3.5-10.5L138 58l10.5-3.5z"
        fill={colors.tertiary}
      />
    </Svg>
  );
};

const ILLUSTRATIONS: Record<IllustrationName, () => React.JSX.Element> = {
  private: Private,
  models: Models,
  images: Images,
  start: Start,
};

const Illustration = ({ name }: { name: IllustrationName }) => {
  const Component = ILLUSTRATIONS[name];
  return <Component />;
};

export default Illustration;
