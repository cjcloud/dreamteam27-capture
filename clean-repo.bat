@echo off
echo Downloading BFG Repo-Cleaner...
curl -L https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -o bfg.jar

echo Creating backup of your repository...
mkdir repo-backup
xcopy /E /I /H /Y . repo-backup

echo Cleaning repository of large files...
java -jar bfg.jar --strip-blobs-bigger-than 95M .

echo Running git garbage collection...
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo Repository cleaned! Large files have been removed from history.
echo If you encounter any issues, you can restore from the backup in repo-backup folder.
echo Now you can try running your deployment script again.
