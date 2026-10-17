import type { ImageSourcePropType } from 'react-native';

export const AVATAR_KEYS = [
  'avatar_01', 'avatar_02', 'avatar_03', 'avatar_04',
  'avatar_05', 'avatar_06', 'avatar_07', 'avatar_08',
  'avatar_09', 'avatar_10', 'avatar_11', 'avatar_12',
  'avatar_13', 'avatar_14', 'avatar_15', 'avatar_16',
] as const;

export type AvatarKey = typeof AVATAR_KEYS[number];

export interface AvatarOption {
  key: AvatarKey;
  image: ImageSourcePropType;
}

const AVATAR_IMAGES: Record<AvatarKey, ImageSourcePropType> = {
  avatar_01: require('../../assets/avatars/avatar_01.png'),
  avatar_02: require('../../assets/avatars/avatar_02.png'),
  avatar_03: require('../../assets/avatars/avatar_03.png'),
  avatar_04: require('../../assets/avatars/avatar_04.png'),
  avatar_05: require('../../assets/avatars/avatar_05.png'),
  avatar_06: require('../../assets/avatars/avatar_06.png'),
  avatar_07: require('../../assets/avatars/avatar_07.png'),
  avatar_08: require('../../assets/avatars/avatar_08.png'),
  avatar_09: require('../../assets/avatars/avatar_09.png'),
  avatar_10: require('../../assets/avatars/avatar_10.png'),
  avatar_11: require('../../assets/avatars/avatar_11.png'),
  avatar_12: require('../../assets/avatars/avatar_12.png'),
  avatar_13: require('../../assets/avatars/avatar_13.png'),
  avatar_14: require('../../assets/avatars/avatar_14.png'),
  avatar_15: require('../../assets/avatars/avatar_15.png'),
  avatar_16: require('../../assets/avatars/avatar_16.png'),
};

export const AVATAR_CATALOG: readonly AvatarOption[] = AVATAR_KEYS.map((key) => ({
  key,
  image: AVATAR_IMAGES[key],
}));
