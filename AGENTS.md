<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store dashboard-editable recruitment and embed templates in guild_configs.content; validate them with the shared content schema to keep UI and bot configuration consistent.
- Authorize configuration and image uploads with the existing Discord session and requireGuild check; this app uses Discord-owned authentication, not application auth accounts.
- Store bot images in a private Storage bucket and serve only intentionally uploaded images through an unguessable public image endpoint, because workspace policy blocks public buckets.
