import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, children, onClose, dirty = false, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; dirty?: boolean; busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = overflow; trigger?.focus() }
  }, [])
  function close() {
    if (busy) return
    if (dirty && !window.confirm('Perubahan belum disimpan. Tutup dan buang perubahan?')) return
    onClose()
  }
  return <dialog ref={ref} className="jx-modal" aria-labelledby={titleId} aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); close() }}
    onClick={(event) => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close() } }}>
    <header className="jx-modal-header"><h2 id={titleId}>{title}</h2><button type="button" className="jx-icon-button" aria-label="Tutup modal" disabled={busy} onClick={close}><X size={19}/></button></header>
    <div className="jx-modal-body">{children}</div>
    <footer className="jx-modal-footer"><button type="button" className="jx-button" disabled={busy} onClick={close}>Batal</button></footer>
  </dialog>
}
