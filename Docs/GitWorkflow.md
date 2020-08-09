# 1. Always do before coding

```shell
git pull
```

# 2. After getting a new feature ticket

```shell
git checkout master
git pull
git checkout -b <branchName>
git push -u origin <branchName>
```

# 3. After successfully close a PR -> everybody needs to 

```shell
git checkout master
git pull
```

# 4. Pull changes on master onto feature branch
```shell
git checkout <branchName>
git rebase -i origin/master
git push
```