;; disable the ts-ls LSP client for typescript
((typescript-ts-mode . ((lsp-disabled-clients . (ts-ls))))
 (typescript-mode . ((lsp-disabled-clients . (ts-ls)))))
