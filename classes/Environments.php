<?php
declare(strict_types=1);
namespace Grav\Plugin\RetrorealmBasicLab;
/** Trusted build-owned execution environments, kept separate from native games. */
final class Environments
{
    public static function read(string $directory): array
    {
        $entries=[];
        foreach (glob($directory.'/*.json') ?: [] as $file) {
            $entry=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);
            $id=$entry['id']??'';
            if (!is_string($id) || !preg_match('/^[a-z][a-z0-9-]{0,63}$/D',$id)
                || basename($file)!==$id.'.json' || ($entry['manifestVersion']??null)!==1
                || ($entry['executionType']??null)!=='basic-interpreter'
                || ($entry['entrypoint']??null)!=='assets/environments/'.$id.'/index.html'
                || !is_string($entry['title']??null) || ($entry['prototype']??null)!==true
                || ($entry['historicalSourcesIncluded']??null)!==false) {
                throw new \UnexpectedValueException('Invalid trusted BASIC environment manifest.');
            }
            $entries[$id]=$entry;
        }
        ksort($entries);return $entries;
    }
}
