export const OKX_MATERIAL_PAGE_URL =
  'https://conscious-meerkat-b7e.notion.site/APK-http-www-topzhjdgxcb-com-join-df0b826aa4b840fea1aa4f351529afd1'
export const OKX_MATERIAL_PAGE_ID = 'df0b826a-a4b8-40fe-a1aa-4f351529afd1'

const NOTION_PAGE_ENDPOINT = new URL('/api/v3/loadPageChunk', OKX_MATERIAL_PAGE_URL).toString()
const TITLE_PREFIX = /^最新官方域名&APK域名[：:]/
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{3,64}$/
const RETRY_DELAYS_MS = [1_000, 3_000]

type JsonRecord = Record<string, unknown>

export interface OkxJoinTemplate {
  pageTitle: string
  templateUrl: string
  hostname: string
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function unwrapPageBlock(value: unknown): JsonRecord {
  let current = value

  for (let depth = 0; depth < 5; depth += 1) {
    if (!isRecord(current)) break
    if (isRecord(current.properties)) return current
    current = current.value
  }

  throw new Error('Notion response does not contain the OKX page properties')
}

function richTextToPlainText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Notion OKX page title is missing')
  }

  return value
    .map((segment, index) => {
      if (!Array.isArray(segment) || typeof segment[0] !== 'string') {
        throw new Error(`Notion OKX page title segment ${index} is invalid`)
      }
      return segment[0]
    })
    .join('')
    .trim()
}

function normalizeJoinTemplate(rawUrl: string) {
  const template = new URL(rawUrl)
  if (!['http:', 'https:'].includes(template.protocol)) {
    throw new Error(`Unsupported OKX template protocol: ${template.protocol}`)
  }
  if (template.username || template.password || template.port || template.search || template.hash) {
    throw new Error('OKX join template must not contain credentials, a port, query, or hash')
  }

  const labels = template.hostname.split('.')
  if (
    labels.length < 2 ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  ) {
    throw new Error(`Invalid OKX template hostname: ${template.hostname}`)
  }

  const pathSegments = template.pathname.split('/').filter(Boolean)
  const placeholder = pathSegments[1] ? decodeURIComponent(pathSegments[1]) : ''
  if (
    pathSegments.length !== 2 ||
    pathSegments[0] !== 'join' ||
    !['渠道号', '邀请码'].includes(placeholder)
  ) {
    throw new Error(`OKX template must end with /join/渠道号: ${rawUrl}`)
  }

  template.protocol = 'https:'
  return template
}

export function extractOkxJoinTemplate(payload: unknown): OkxJoinTemplate {
  if (!isRecord(payload) || !isRecord(payload.recordMap)) {
    throw new Error('Notion response does not contain a record map')
  }

  const blocks = payload.recordMap.block
  if (!isRecord(blocks)) throw new Error('Notion response does not contain page blocks')

  const pageBlock = unwrapPageBlock(blocks[OKX_MATERIAL_PAGE_ID])
  const properties = pageBlock.properties
  if (!isRecord(properties)) throw new Error('Notion OKX page properties are invalid')

  const pageTitle = richTextToPlainText(properties.title)
  if (!TITLE_PREFIX.test(pageTitle)) {
    throw new Error(`Unexpected Notion OKX page title: ${pageTitle}`)
  }

  const candidates = pageTitle.match(/https?:\/\/[^\s]+/gi) ?? []
  if (candidates.length !== 1) {
    throw new Error(`Expected one OKX join template in the page title, received ${candidates.length}`)
  }

  const template = normalizeJoinTemplate(candidates[0])
  return {
    pageTitle,
    templateUrl: template.toString(),
    hostname: template.hostname,
  }
}

export function buildOkxGreenChannelUrl(templateUrl: string, referralCode: string) {
  if (!REFERRAL_CODE_PATTERN.test(referralCode)) {
    throw new Error(`Invalid OKX referral code: ${referralCode}`)
  }

  const target = normalizeJoinTemplate(templateUrl)
  target.pathname = `/join/${referralCode}`
  return target.toString()
}

export async function fetchOkxJoinTemplate(): Promise<OkxJoinTemplate> {
  let lastError: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(NOTION_PAGE_ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'tosky-referral-directory-sync/1.0',
        },
        body: JSON.stringify({
          pageId: OKX_MATERIAL_PAGE_ID,
          limit: 100,
          cursor: { stack: [] },
          chunkNumber: 0,
          verticalColumns: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Notion OKX material page request failed: HTTP ${response.status}`)
      }

      return extractOkxJoinTemplate(await response.json())
    } catch (error) {
      lastError = error
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) break
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Unable to read the Notion OKX material page after 3 attempts: ${message}`)
}
