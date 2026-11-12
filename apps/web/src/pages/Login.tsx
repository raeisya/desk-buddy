import { useState } from 'react'
import { usePersona } from '../persona/personaContext'
import { frameStyle, variantFor } from '../theme/characters'
import './login.css'

/** The three demo journeys, in the order the pitch tells them. */
const FEATURED = [
  { id: 'u-alia', chip: 'HOD', chipClass: 'db-chip--red', blurb: "See who's in today and how the floor is used" },
  { id: 'u-hafiz', chip: 'Staff', chipClass: 'db-chip--soft', blurb: 'Post "wfh today" in Slack and your desk frees itself' },
  { id: 'u-aina', chip: 'New joiner', chipClass: 'db-chip--ok', blurb: 'Day one, no desk yet. Find a free seat near your team' },
] as const

/**
 * Demo login = persona picker (C). Picking a persona calls B's setPersona(); the app takes over.
 * "Sign in with Slack" is show-only: real OAuth is roadmap.
 */
export function Login() {
  const { users, setPersona } = usePersona()
  const [slackClicked, setSlackClicked] = useState(false)

  const featured = FEATURED.flatMap((f) => {
    const user = users.find((u) => u.id === f.id)
    return user ? [{ ...f, user }] : []
  })

  return (
    <div className="login">
      <header className="login-brand">
        <span className="db-label">Acme Tech · Level 12</span>
        <h1 className="login-logo">DeskBuddy</h1>
        <p className="login-tagline">Every empty desk, put to work.</p>
      </header>

      <section className="db-panel login-panel" aria-labelledby="login-title">
        <div className="db-panel__head">
          <h2 id="login-title" className="db-panel__title">Who are you today?</h2>
          <span className="db-panel__hint">Pick a demo persona</span>
        </div>

        <div className="login-personas">
          {featured.map(({ user, chip, chipClass, blurb }) => (
            <button key={user.id} type="button" className="persona-card" onClick={() => setPersona(user)}>
              <span className="persona-sprite" style={frameStyle(variantFor(user.id), 'down', 0)} aria-hidden="true" />
              <span className="persona-text">
                <span className="persona-name">{user.name}</span>
                <span className={`db-chip ${chipClass}`}>
                  {chip} · {user.team}
                </span>
                <span className="persona-blurb">{blurb}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="login-alt">
        <div className="login-slack">
          <span id="slack-note" className="db-label" role="status">
            {slackClicked ? 'On our roadmap · pick a persona for now' : 'Coming soon'}
          </span>
          <button type="button" className="db-btn db-btn--plain" onClick={() => setSlackClicked(true)} aria-describedby="slack-note">
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="2" width="14" height="14" />
              <path d="M6 9h6M9 6v6" />
            </svg>
            Sign in with Slack
          </button>
        </div>
        </div>
      </section>

      <footer className="tb-footer login-footer">
        <span>Dwg DB-000 · Sign-in sheet</span>
        <span>Scale 1:1 · Rev B</span>
      </footer>
    </div>
  )
}
