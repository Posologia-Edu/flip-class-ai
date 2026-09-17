/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as feedbackCompleted } from './feedback-completed.tsx'
import { template as contactMessage } from './contact-message.tsx'
import { template as institutionalAccountAdded } from './institutional-account-added.tsx'
import { template as institutionalInvite } from './institutional-invite.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'feedback-completed': feedbackCompleted,
  'contact-message': contactMessage,
  'institutional-account-added': institutionalAccountAdded,
  'institutional-invite': institutionalInvite,
}
