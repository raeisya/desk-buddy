import { useState } from 'react'
import { api } from '../api/client'
import { PANTS_COLOURS, SKIN_TONES, type AvatarConfig, type UserSummary } from '../api/contracts'
import { variantFor } from '../theme/characters'
import {
  avatarFrameStyle,
  avatarFromConfig,
  configFromAvatar,
  PANTS,
  PRESET_AVATARS,
  rememberSaved,
  rgbToHex,
  savedLookOf,
  SKINS,
  type HairStyle,
  type PantsColour,
  type SkinTone,
} from './characterArt'
import './avatarPicker.css'

const STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Short hair' },
  { id: 'long', label: 'Long hair' },
  { id: 'hijab', label: 'Hijab' },
]
const HAIR_COLOURS = [
  { name: 'Black', hex: '#28242c' },
  { name: 'Dark brown', hex: '#4e3428' },
  { name: 'Brown', hex: '#785032' },
  { name: 'Auburn', hex: '#96462a' },
  { name: 'Grey', hex: '#8c8c92' },
]
const HIJAB_COLOURS = [
  { name: 'Maroon', hex: '#963c5a' },
  { name: 'Teal', hex: '#3c8c8c' },
  { name: 'Navy', hex: '#323c6e' },
  { name: 'Black', hex: '#28282e' },
  { name: 'Cream', hex: '#e6dcc8' },
  { name: 'Pink', hex: '#e68aaa' },
  { name: 'Olive', hex: '#6e7846' },
  { name: 'Lilac', hex: '#a08cc8' },
]
const SHIRT_COLOURS = [
  { name: 'Blue', hex: '#4682c8' },
  { name: 'Green', hex: '#5aa064' },
  { name: 'Mustard', hex: '#dcaa3c' },
  { name: 'Red', hex: '#c85046' },
  { name: 'Orange', hex: '#e6823c' },
  { name: 'Lilac', hex: '#a08cc8' },
  { name: 'Grey', hex: '#969caa' },
  { name: 'Cream', hex: '#ece4ce' },
  { name: 'Black', hex: '#2e2e36' },
]
const SKIN_NAMES: Record<SkinTone, string> = { light: 'Light', medlight: 'Medium light', tan: 'Tan', brown: 'Brown', deep: 'Deep' }
const PANTS_NAMES: Record<PantsColour, string> = { navy: 'Navy', charcoal: 'Charcoal', khaki: 'Khaki', black: 'Black' }

const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

interface Props {
  persona: UserSummary
  /** Refetch the floor so the new look shows on the map for everyone. */
  onSaved: () => void
}

/** Character customization (Me page): pick hair, colours, skin, shirt and trousers; everyone sees it. */
export function AvatarPicker({ persona, onSaved }: Props) {
  const current = (): AvatarConfig => savedLookOf(persona.id) ?? configFromAvatar(PRESET_AVATARS[variantFor(persona.id)])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AvatarConfig>(current)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const preview = avatarFromConfig(draft)
  const hairChoices = draft.style === 'hijab' ? HIJAB_COLOURS : HAIR_COLOURS

  function pickStyle(style: HairStyle) {
    setDraft((d) => {
      const palette = style === 'hijab' ? HIJAB_COLOURS : HAIR_COLOURS
      // hair ↔ hijab: keep the colour only if it belongs to the new palette
      const hair = palette.some((c) => sameHex(c.hex, d.hair)) ? d.hair : palette[0].hex
      return { ...d, style, hair }
    })
  }

  async function save(next: AvatarConfig | null) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await api.setAvatar(persona.id, next)
      rememberSaved(persona.id, r.avatar)
      if (!r.avatar) setDraft(configFromAvatar(PRESET_AVATARS[variantFor(persona.id)]))
      setMsg({ ok: true, text: r.avatar ? 'Saved. Everyone sees your new look on the map.' : 'Back to your default look.' })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="me-look">
      <div className="me-look__head">
        <h2 className="db-label">Your character</h2>
        <button
          type="button"
          className="db-btn db-btn--secondary"
          aria-expanded={open}
          onClick={() => {
            if (!open) setDraft(current())
            setOpen((o) => !o)
            setMsg(null)
          }}
        >
          {open ? 'Close' : 'Customize'}
        </button>
      </div>

      {open && (
        <div className="me-look__body">
          <div className="me-look__preview" aria-label="Preview of your character">
            <span className="me-look__sprite" style={avatarFrameStyle(preview, 'down', 0)} />
            <span className="me-look__sprite" style={avatarFrameStyle(preview, 'right', 0)} />
          </div>

          <div className="me-look__options">
            <fieldset>
              <legend className="db-label">Hair</legend>
              <div className="me-look__seg">
                {STYLES.map((s) => (
                  <button key={s.id} type="button" className={draft.style === s.id ? 'on' : ''} aria-pressed={draft.style === s.id} onClick={() => pickStyle(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <Swatches
              legend={draft.style === 'hijab' ? 'Hijab colour' : 'Hair colour'}
              options={hairChoices.map((c) => ({ id: c.hex, name: c.name, colour: c.hex }))}
              value={draft.hair}
              onPick={(hair) => setDraft((d) => ({ ...d, hair }))}
            />
            <Swatches
              legend="Skin"
              options={SKIN_TONES.map((k) => ({ id: k, name: SKIN_NAMES[k], colour: rgbToHex(SKINS[k]) })) /* the server's list */}
              value={draft.skin}
              onPick={(skin) => setDraft((d) => ({ ...d, skin: skin as SkinTone }))}
            />
            <Swatches
              legend="Shirt"
              options={SHIRT_COLOURS.map((c) => ({ id: c.hex, name: c.name, colour: c.hex }))}
              value={draft.shirt}
              onPick={(shirt) => setDraft((d) => ({ ...d, shirt }))}
            />
            <Swatches
              legend="Trousers"
              options={PANTS_COLOURS.map((k) => ({ id: k, name: PANTS_NAMES[k], colour: rgbToHex(PANTS[k]) }))}
              value={draft.pants}
              onPick={(pants) => setDraft((d) => ({ ...d, pants: pants as PantsColour }))}
            />
          </div>

          <div className="me-look__actions">
            <button type="button" className="db-btn" disabled={busy} onClick={() => save(draft)}>
              {busy ? 'Saving…' : 'Save my look'}
            </button>
            <button type="button" className="db-btn db-btn--secondary" disabled={busy} onClick={() => save(null)}>
              Reset to default
            </button>
          </div>
          {msg && (
            <p className={msg.ok ? 'me-msg' : 'error'} role="status">
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Swatches(props: {
  legend: string
  options: { id: string; name: string; colour: string }[]
  value: string
  onPick: (id: string) => void
}) {
  return (
    <fieldset>
      <legend className="db-label">{props.legend}</legend>
      <div className="me-look__swatches">
        {props.options.map((o) => {
          const on = sameHex(o.id, props.value)
          return (
            <button
              key={o.id}
              type="button"
              className={`me-look__swatch${on ? ' on' : ''}`}
              style={{ background: o.colour }}
              aria-label={o.name}
              aria-pressed={on}
              title={o.name}
              onClick={() => props.onPick(o.id)}
            />
          )
        })}
      </div>
    </fieldset>
  )
}
