<?php
declare(strict_types=1);
namespace Grav\Plugin\RetrorealmBasicLab;

/** Only trusted, installed packages are registered; Admin cannot upload code. */
final class Catalog
{
    public static function read(string $directory, bool $strict = true): array
    {
        $games = [];
        foreach (glob($directory . '/*.json') ?: [] as $file) {
          try {
            $game = json_decode(file_get_contents($file), true, 24, JSON_THROW_ON_ERROR);
            if (!is_array($game) || !preg_match('/\A[a-z][a-z0-9-]{0,63}\z/', $game['id'] ?? '') || basename($file, '.json') !== $game['id']) {
                throw new \UnexpectedValueException('Invalid game manifest ID.');
            }
            foreach (['title', 'description', 'author', 'version', 'edition', 'licensingStatus'] as $key) {
                if (!is_string($game[$key] ?? null) || strlen($game[$key]) > 2000) {
                    throw new \UnexpectedValueException('Invalid game metadata.');
                }
            }
            if (isset($game['legacyEntrypoint']) && $game['legacyEntrypoint'] !== 'assets/player/0.1.0/index.html') throw new \UnexpectedValueException('Invalid compatibility entrypoint.');
            if (($game['manifestVersion'] ?? null) !== 1 || !in_array($game['adapter'] ?? '', ['native', 'basic-interpreter'], true) || !is_int($game['saveVersion'] ?? null) || $game['saveVersion'] < 1) throw new \UnexpectedValueException('Invalid package interface.');
            // Build-owned entrypoints only. Never concatenate editable IDs/paths.
            if (!in_array($game['entrypoint'] ?? '', ['assets/games/' . $game['id'] . '/index.html', $game['legacyEntrypoint'] ?? null], true) || !is_array($game['rulesets'] ?? null) || !$game['rulesets']) {
                throw new \UnexpectedValueException('Untrusted player entrypoint.');
            }
            foreach ($game['rulesets'] as $ruleset) {
                if (!is_string($ruleset) || !preg_match('/\A[a-z0-9.-]+\z/', $ruleset)) throw new \UnexpectedValueException('Invalid ruleset.');
            }
            if (!in_array($game['defaultRuleset'] ?? '', $game['rulesets'], true) || !is_array($game['editions'] ?? null) || array_keys($game['editions']) !== $game['rulesets']) throw new \UnexpectedValueException('Invalid edition metadata.');
            foreach ($game['editions'] as $label) if (!is_string($label) || strlen($label) > 200) throw new \UnexpectedValueException('Invalid edition label.');
            foreach (['active', 'draft', 'downloadsPermitted'] as $key) {
                if (!is_bool($game[$key] ?? null)) throw new \UnexpectedValueException('Invalid manifest flag.');
            }
            foreach ($game['references'] ?? [] as $url) {
                if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL) || parse_url($url, PHP_URL_SCHEME) !== 'https') throw new \UnexpectedValueException('Invalid reference URL.');
            }
            if (isset($game['exhibit'])) {
                $exhibit = $game['exhibit'];
                if (!is_array($exhibit)) throw new \UnexpectedValueException('Invalid exhibit context.');
                foreach (['heading', 'description'] as $field) {
                    if (!is_string($exhibit[$field] ?? null) || strlen($exhibit[$field]) > 2000) throw new \UnexpectedValueException('Invalid exhibit text.');
                }
                if (!is_array($exhibit['facts'] ?? null) || !array_is_list($exhibit['facts']) || count($exhibit['facts']) > 12) throw new \UnexpectedValueException('Invalid exhibit facts.');
                foreach ($exhibit['facts'] as $fact) {
                    if (!is_array($fact)) throw new \UnexpectedValueException('Invalid exhibit fact.');
                    foreach (['label', 'value'] as $field) if (!is_string($fact[$field] ?? null) || strlen($fact[$field]) > 2000) throw new \UnexpectedValueException('Invalid exhibit fact text.');
                }
            }
            $games[$game['id']] = $game;
          } catch (\Throwable $error) {
            if ($strict) throw $error;
            error_log('BASIC Lab skipped invalid installed manifest ' . basename($file) . ': ' . $error->getMessage());
          }
        }
        return $games;
    }

    /** Trusted editorial HTML is not sanitized here; the page already owns its h1. */
    public static function manualFragment(string $html): string
    {
        return preg_replace('/<(\/?)h1(\b[^>]*)>/i', '<$1h2$2>', $html);
    }

    public static function route(string $route): string
    {
        if (!preg_match('#\A/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*\z#', $route)) {
            throw new \UnexpectedValueException('Invalid BASIC Lab route.');
        }
        return $route;
    }
}
