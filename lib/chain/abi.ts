// lib/chain/abi.ts
export const PET_RACING_ABI = [
  {
    name: 'getRace',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'raceId', type: 'uint256' }],
    outputs: [
      { name: 'phase', type: 'uint8' },
      { name: 'entryFee', type: 'uint256' },
      { name: 'prizePool', type: 'uint256' },
      { name: 'fieldSize', type: 'uint256' },
      { name: 'filledSlots', type: 'uint256' },
      { name: 'trackLength', type: 'uint256' },
      { name: 'extraParamIds', type: 'uint256[]' },
      { name: 'extraParamVals', type: 'uint256[]' },
    ],
  },
  {
    name: 'previewPayouts',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'raceId', type: 'uint256' }],
    outputs: [
      { name: 'payouts', type: 'uint256[]' },
      { name: 'prizePool', type: 'uint256' },
    ],
  },
  {
    name: 'getPetRacesRun',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'petId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'canPetRace',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'petId', type: 'uint256' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getJackpotConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'maxChanceBps', type: 'uint256' },
      { name: 'winnableBps', type: 'uint256' },
      { name: 'targetFee', type: 'uint256' },
      { name: 'eligibleJackpot', type: 'uint256' },
    ],
  },
] as const
