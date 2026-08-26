import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://xacjkfquzkbyqxekazxi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhY2prZnF1emtieXF4ZWthenhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODM3MDgsImV4cCI6MjEwMjY1OTcwOH0.6JWOKnDfwAuLiBvX2DUYxH9C3UzFq0VoTn76rEpP8S0'
)
