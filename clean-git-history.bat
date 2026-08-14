@echo off
echo Creating backup of your repository...
mkdir repo-backup-2
xcopy /E /I /H /Y . repo-backup-2

echo Removing .firebase directory from Git history...
git filter-branch --force --index-filter "git rm -r --cached --ignore-unmatch .firebase" --prune-empty --tag-name-filter cat -- --all

echo Running git garbage collection...
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo Repository cleaned! Large files have been removed from history.
echo If you encounter any issues, you can restore from the backup in repo-backup-2 folder.
echo Now you can try running your deployment script again.
