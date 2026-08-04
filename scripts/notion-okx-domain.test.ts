import { describe, expect, it } from 'vitest'
import {
  buildOkxGreenChannelUrl,
  extractOkxJoinTemplate,
  OKX_MATERIAL_PAGE_ID,
} from './notion-okx-domain'

function notionPayload(title: unknown) {
  return {
    recordMap: {
      block: {
        [OKX_MATERIAL_PAGE_ID]: {
          value: {
            value: {
              properties: { title },
              crdt_data: {
                staleHistory: 'http://www.old-domain.example/join/渠道号',
              },
            },
            role: 'reader',
          },
        },
      },
    },
  }
}

describe('OKX Notion domain sync', () => {
  it('reads only the current root-page title and upgrades the template to HTTPS', () => {
    const template = extractOkxJoinTemplate(
      notionPayload([
        ['最新官方域名&APK域名：'],
        ['http://www.topzhjdgxcb.com/join/渠道号', [['b']]],
      ]),
    )

    expect(template).toEqual({
      pageTitle:
        '最新官方域名&APK域名：http://www.topzhjdgxcb.com/join/渠道号',
      templateUrl:
        'https://www.topzhjdgxcb.com/join/%E6%B8%A0%E9%81%93%E5%8F%B7',
      hostname: 'www.topzhjdgxcb.com',
    })
    expect(buildOkxGreenChannelUrl(template.templateUrl, '88596413')).toBe(
      'https://www.topzhjdgxcb.com/join/88596413',
    )
  })

  it('rejects an APK URL or a non-join URL in the page title', () => {
    expect(() =>
      extractOkxJoinTemplate(
        notionPayload([
          ['最新官方域名&APK域名：'],
          ['https://www.dkgwpqxvfnr.com/upgradeapp/android_邀请码.apk'],
        ]),
      ),
    ).toThrow('must end with /join/渠道号')
  })

  it('rejects malformed invitation codes', () => {
    expect(() =>
      buildOkxGreenChannelUrl(
        'https://www.topzhjdgxcb.com/join/渠道号',
        '../wrong',
      ),
    ).toThrow('Invalid OKX referral code')
  })
})
