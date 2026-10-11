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

- Use the shared Logo component and its asset pointer for site branding so replacements stay consistent.
- Market charts consume provider data only and show unavailable states rather than fabricated fallback points.
- Administration uses authenticated server functions and a separate user_roles table; validate roles before all privileged data access.
- Identity decisions run through an atomic database function with an audit record so changes are traceable.
- Wallet transfers remain practice-account operations until a licensed funding provider is connected; never imply bank settlement.
