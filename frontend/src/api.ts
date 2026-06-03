import axios from 'axios'
import type { StockRecommendation, OHLCVData, PortfolioResult } from './types'

const BASE = '/api'

const client = axios.create({
  baseURL: BASE,
  timeout: 120_000, // Screener can take a while fetching many symbols
})

export async function fetchTop20(params?: {
  asset_types?: string
  limit?: number
  sector?: string
  min_market_cap?: number
  max_pe?: number
  min_roe?: number
  signal?: string
}): Promise<StockRecommendation[]> {
  const { data } = await client.get<StockRecommendation[]>('/top20', { params })
  return data
}

export async function fetchStocks(limit = 20): Promise<StockRecommendation[]> {
  const { data } = await client.get<StockRecommendation[]>('/stocks', { params: { limit } })
  return data
}

export async function fetchETFs(limit = 20): Promise<StockRecommendation[]> {
  const { data } = await client.get<StockRecommendation[]>('/etfs', { params: { limit } })
  return data
}

export async function fetchMutualFunds(limit = 10): Promise<StockRecommendation[]> {
  const { data } = await client.get<StockRecommendation[]>('/mutual-funds', { params: { limit } })
  return data
}

export async function fetchSymbolDetail(symbol: string): Promise<StockRecommendation> {
  const { data } = await client.get<StockRecommendation>(`/symbol/${symbol}`)
  return data
}

export async function fetchChartData(
  symbol: string,
  period = '1y',
  interval = '1d'
): Promise<OHLCVData[]> {
  const { data } = await client.get<OHLCVData[]>(`/chart/${symbol}`, {
    params: { period, interval },
  })
  return data
}

export async function analyzePortfolio(
  holdings: Array<{ symbol: string; shares: number; avg_cost: number }>
): Promise<PortfolioResult> {
  const { data } = await client.post<PortfolioResult>('/portfolio/analyze', holdings)
  return data
}

export async function searchSymbols(q: string): Promise<Array<{ symbol: string; type: string }>> {
  const { data } = await client.get('/search', { params: { q } })
  return data
}
