// lib/chain/petRacing.ts
import { createPublicClient, http } from 'viem'
import { abstract } from 'viem/chains'
import { PET_RACING_ABI } from './abi'
import type { PayoutPreview } from '@/types/racing'
import { weiToEth } from '@/lib/encode'

const CONTRACT = '0x16e0B3D6394CE7597D34b73f5E5Fb165fD74394E' as const

function getClient() {
  return createPublicClient({
    chain: abstract,
    transport: http(process.env.ABSTRACT_RPC_URL ?? 'https://api.mainnet.abs.xyz'),
  })
}

export async function previewPayouts(raceId: number | string): Promise<PayoutPreview | null> {
  try {
    const client = getClient()
    const id = BigInt(raceId)

    const [payoutsRaw, prizePoolRaw] = await client.readContract({
      address: CONTRACT,
      abi: PET_RACING_ABI,
      functionName: 'previewPayouts',
      args: [id],
    }) as [readonly bigint[], bigint]

    const raceData = await client.readContract({
      address: CONTRACT,
      abi: PET_RACING_ABI,
      functionName: 'getRace',
      args: [id],
    }) as readonly [number, bigint, bigint, bigint, bigint, bigint, readonly bigint[], readonly bigint[]]

    const [, entryFee, , fieldSize] = raceData

    return {
      entryFee: entryFee.toString(),
      fieldSize: Number(fieldSize),
      prizePool: prizePoolRaw.toString(),
      payouts: payoutsRaw.map((amt, i) => ({ rank: i + 1, amount: amt.toString() })),
      jackpotEligible: entryFee > 0n,
    }
  } catch (e) {
    console.error('previewPayouts chain call failed:', e)
    return null
  }
}

export async function getJackpotExpectedValue(
  raceId: number | string,
  winProb: number,
  entryFeeWei: string,
): Promise<number> {
  try {
    const client = getClient()
    const config = await client.readContract({
      address: CONTRACT,
      abi: PET_RACING_ABI,
      functionName: 'getJackpotConfig',
    }) as readonly [bigint, bigint, bigint, bigint]

    const [maxChanceBps, winnableBps, targetFee, eligibleJackpot] = config
    if (eligibleJackpot === 0n) return 0

    const entryFeeWeiBI = BigInt(entryFeeWei || '0')
    if (entryFeeWeiBI === 0n) return 0

    const rollChance = (Number(maxChanceBps) / 10000) *
      (Math.min(Number(entryFeeWeiBI), Number(targetFee)) / Number(targetFee))

    const jackpotPayout = weiToEth(((eligibleJackpot * winnableBps) / 10000n).toString())
    return winProb * rollChance * jackpotPayout
  } catch {
    return 0
  }
}

export async function getPetRacesRun(petId: number): Promise<number> {
  try {
    const client = getClient()
    const result = await client.readContract({
      address: CONTRACT,
      abi: PET_RACING_ABI,
      functionName: 'getPetRacesRun',
      args: [BigInt(petId)],
    }) as bigint
    return Number(result)
  } catch {
    return 0
  }
}
