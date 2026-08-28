// src/utils/playerColors.ts

export interface PlayerColor {
  id: string;
  gradient: string;
  primary: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  { id: 'Black Velvet', gradient: 'linear-gradient(to bottom right, #111111, #3B3B5C, #24243E)', primary: '#111111' },
  { id: 'Chateau Shenandeaux', gradient: 'linear-gradient(to bottom right, #4A001F, #FF0084)', primary: '#FF0084' },
  { id: 'Laser Tag', gradient: 'linear-gradient(to bottom right, #F000FF, #101820)', primary: '#F000FF' },
  { id: 'Cosmic Bruise', gradient: 'linear-gradient(to bottom right, #4A6CF7, #512DA8)', primary: '#512DA8' },
  { id: 'Synthwave Blood Moon', gradient: 'linear-gradient(to bottom right, #5E17EB, #F72585)', primary: '#F72585' },
  { id: 'Midlife Crisis', gradient: 'linear-gradient(to bottom right, #231557, #7B1FA2, #FF1361, #FFD600)', primary: '#7B1FA2' },
  { id: 'Blue Screen of Death', gradient: 'linear-gradient(to bottom right, #007BFF, #3A47FF)', primary: '#3A47FF' },
  { id: 'Arctic Blast', gradient: 'linear-gradient(to bottom right, #245B8A, #0FA3B1)', primary: '#0FA3B1' },
  { id: 'Vaporwave Sunset', gradient: 'linear-gradient(to bottom right, #F20ACB, #1822FA)', primary: '#1822FA' },
  { id: '90s Windbreaker', gradient: 'linear-gradient(to bottom right, #00C9C8, #D600FF)', primary: '#00C9C8' },
  { id: 'Swamp Ass', gradient: 'linear-gradient(to bottom right, #264653, #39FF88)', primary: '#39FF88' },
  { id: 'Virtual Insanity', gradient: 'linear-gradient(to bottom right, #00D9A6, #6546F2)', primary: '#00D9A6' },
  { id: 'Walk of Shame', gradient: 'linear-gradient(to bottom right, #E91E63, #FF6D00)', primary: '#E91E63' },
  { id: 'Hot Flamingo', gradient: 'linear-gradient(to bottom right, #FF6F91, #E100E1)', primary: '#E100E1' },
  { id: 'LSD', gradient: 'linear-gradient(to bottom right, #FF1744, #8E24AA, #2979FF, #00E5FF, #00E676, #FFEA00)', primary: '#FF1744' },
  { id: 'Toxic Slurpee', gradient: 'linear-gradient(to bottom right, #00F5A0, #00D9F5, #5B2EFF)', primary: '#00F5A0' },
  { id: 'Sunrise Sherbet', gradient: 'linear-gradient(to bottom right, #FF7043, #FFB300)', primary: '#FF7043' },
  { id: 'Green', gradient: 'linear-gradient(to bottom right, #72FFB6, #10D164)', primary: '#10D164' },
  { id: 'Red', gradient: 'linear-gradient(to bottom right, #FF8A8A, #E53935)', primary: '#E53935' },
  { id: 'Blue', gradient: 'linear-gradient(to bottom right, #7FD8FF, #2196F3)', primary: '#2196F3' },
  { id: 'Purple', gradient: 'linear-gradient(to bottom right, #C79CFF, #8E44AD)', primary: '#8E44AD' },
  { id: 'Violet', gradient: 'linear-gradient(to bottom right, #C8A2FF, #7C3AED)', primary: '#7C3AED' },
  { id: 'Pink', gradient: 'linear-gradient(to bottom right, #FFB3E6, #FF4FA3)', primary: '#FF4FA3' },
  { id: 'Yellow', gradient: 'linear-gradient(to bottom right, #FFF59D, #F4C20D)', primary: '#F4C20D' },
];

// Helper function to find the full color object from just the primary hex code
export const getColorObject = (primaryColor: string): PlayerColor | undefined => {
  return PLAYER_COLORS.find(c => c.primary === primaryColor);
};
 