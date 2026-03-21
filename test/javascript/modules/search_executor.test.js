import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseFieldSpec } from '../../../app/javascript/modules/search_executor'

describe('parseFieldSpec', () => {
  it('parses a simple title field', () => {
    const spec = parseFieldSpec('title')
    expect(spec.title).toBe('title')
    expect(spec.fields).toEqual(['title'])
  })

  it('parses title and sub fields', () => {
    const spec = parseFieldSpec('title overview')
    expect(spec.title).toBe('title')
    expect(spec.subs).toEqual(['overview'])
  })

  it('parses typed fields like id:_id', () => {
    const spec = parseFieldSpec('id:_id title:name')
    expect(spec.id).toBe('_id')
    expect(spec.title).toBe('name')
  })

  it('parses complex field spec with thumb', () => {
    const spec = parseFieldSpec('id:doc_id title overview thumb:poster_url')
    expect(spec.id).toBe('doc_id')
    expect(spec.title).toBe('title')
    expect(spec.subs).toContain('overview')
    expect(spec.thumb).toBe('poster_url')
  })

  it('defaults id to "id" when present in fields', () => {
    const spec = parseFieldSpec('id title')
    expect(spec.id).toBe('id')
  })

  it('returns empty result for null input', () => {
    const spec = parseFieldSpec(null)
    expect(spec.title).toBeNull()
    expect(spec.fields).toEqual([])
  })

  it('handles comma-separated specs', () => {
    const spec = parseFieldSpec('title,overview,id')
    expect(spec.title).toBe('title')
    expect(spec.subs).toContain('overview')
    expect(spec.id).toBe('id')
  })
})
