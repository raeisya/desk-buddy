import { useState } from 'react'
import { LangToggle, useLang } from '../i18n/lang'
import { usePersona } from '../persona/personaContext'
import './login.css'
import { personFrameStyle } from '../components/characterArt'

/** The demo journeys, in the order the pitch tells them. */
const FEATURED = [
  { id: 'u-alia', chip: 'roleHod', chipClass: 'db-chip--red', blurb: 'blurbHod' },
  { id: 'u-hafiz', chip: 'roleStaff', chipClass: 'db-chip--soft', blurb: 'blurbStaff' },
  { id: 'u-aina', chip: 'roleNewJoiner', chipClass: 'db-chip--ok', blurb: 'blurbNewJoiner' },
  { id: 'u-melissa', chip: 'roleAdmin', chipClass: 'db-chip--soft', blurb: 'blurbAdmin' },
] as const

/** Set once on load if the API sent us back with `#slack=error`; clears the hash. */
function readSlackError(): boolean {
  if (window.location.hash !== '#slack=error') return false
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return true
}

/**
 * Demo login = persona picker (C). Picking a persona calls B's setPersona(); the app takes over.
 * "Sign in with Slack" goes through the API (/api/auth/slack) and lands back as the linked persona.
 */
export function Login() {
  const { users, setPersona } = usePersona()
  const [slackFailed] = useState(readSlackError)
  const { t } = useLang()

  const featured = FEATURED.flatMap((f) => {
    const user = users.find((u) => u.id === f.id)
    return user ? [{ ...f, user }] : []
  })

  return (
    <div className="login">
      <header className="login-brand">
        <span className="db-label">Acme Tech · Level 12</span>
        <h1 className="login-logo">DeskBuddy</h1>
        <p className="login-tagline">{t('tagline')}</p>
        <LangToggle />
      </header>

      <section className="db-panel login-panel" aria-labelledby="login-title">
        <div className="db-panel__head">
          <h2 id="login-title" className="db-panel__title">{t('loginTitle')}</h2>
          <span className="db-panel__hint">{t('loginHint')}</span>
        </div>

        <div className="login-personas">
          {featured.map(({ user, chip, chipClass, blurb }) => (
            <button key={user.id} type="button" className="persona-card" onClick={() => setPersona(user)}>
              <span className="persona-sprite" style={personFrameStyle(user.id, 'down', 0)} aria-hidden="true" />
              <span className="persona-text">
                <span className="persona-name">{user.name}</span>
                <span className={`db-chip ${chipClass}`}>
                  {t(chip)} · {user.team}
                </span>
                <span className="persona-blurb">{t(blurb)}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="login-alt">
        <div className="login-slack">
          <span id="slack-note" className="db-label" role="status">
            {slackFailed ? t('slackFailed') : t('slackNote')}
          </span>
          <a href="/api/auth/slack" className="db-btn db-btn--plain" aria-describedby="slack-note">
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="2" width="14" height="14" />
              <path d="M6 9h6M9 6v6" />
            </svg>
            {t('slackButton')}
          </a>
        </div>
        </div>
      </section>

      <footer className="tb-footer login-footer">
        <span>{t('footerLeft')}</span>
        <span>{t('footerRight')}</span>
      </footer>
    </div>
  )
}
